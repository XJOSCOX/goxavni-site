import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import express from "express";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 3000);
const authCookieName = "goxavni_bookkeeper";
const sessionMaxAgeMs = 1000 * 60 * 30;
const roles = ["owner", "manager", "member"];
const accountTypes = ["asset", "liability", "equity", "revenue", "expense"];
const transactionTypes = ["income", "expense"];
const recurrenceUnits = ["day", "week", "month", "year"];
const sessionSecret = process.env.SESSION_SECRET || "local-dev-change-this-secret";
const hasSupabaseConfig = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.json());
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/public", express.static(path.join(rootDir, "public")));
app.use(express.static(distDir));

const defaultAccounts = [
  ["1000", "Operating Cash", "asset"],
  ["1100", "Accounts Receivable", "asset"],
  ["2000", "Accounts Payable", "liability"],
  ["3000", "Owner Equity", "equity"],
  ["4000", "Sales Revenue", "revenue"],
  ["4100", "Software Revenue", "revenue"],
  ["5000", "Office Supplies", "expense"],
  ["5100", "Contract Labor", "expense"],
  ["5200", "Hosting and Software", "expense"],
  ["5300", "Taxes and Licenses", "expense"]
];

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function encodeAuthCookie(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeAuthCookie(req) {
  const value = parseCookies(req)[authCookieName];
  if (!value) return null;

  const [body, signature] = value.split(".");
  if (!body || !signature || signature !== sign(body)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function setAuthCookie(res, userId) {
  res.cookie(authCookieName, encodeAuthCookie({ userId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionMaxAgeMs
  });
}

function clearAuthCookie(res) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function centsFromInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
}

function formatMoney(cents) {
  return Number(cents || 0) / 100;
}

function canManageRole(actorRole, targetRole) {
  if (actorRole === "owner") return roles.includes(targetRole);
  if (actorRole === "manager") return targetRole === "member";
  return false;
}

function codeHash(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function signupCodesFromEnv() {
  return [
    ["owner", process.env.OWNER_SIGNUP_CODE],
    ["manager", process.env.MANAGER_SIGNUP_CODE],
    ["member", process.env.MEMBER_SIGNUP_CODE]
  ]
    .map(([role, code]) => ({ role, code: String(code || "").trim() }))
    .filter((entry) => entry.code.length >= 32);
}

function roleFromSignupCode(inputCode) {
  const code = String(inputCode || "").trim();
  if (!code) return null;

  const inputHash = codeHash(code);
  return signupCodesFromEnv().find((entry) => {
    const expected = Buffer.from(codeHash(entry.code), "hex");
    const actual = Buffer.from(inputHash, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  })?.role || null;
}

function cleanAccount(account) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    active: Boolean(account.active)
  };
}

function validateAccount(body) {
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  const type = String(body.type || "").trim();
  const active = parseBoolean(body.active, true);

  if (!code || !name || !accountTypes.includes(type)) {
    return { error: "Account code, name, and type are required." };
  }

  return { value: { code, name, type, active } };
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0" || value === "") return false;
  return fallback;
}

function dateRangeFromQuery(query) {
  const from = String(query.from || "").trim();
  const to = String(query.to || "").trim();
  return {
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null,
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function sendCsv(res, filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`${csv}\n`);
}

function validateMember(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const title = String(body.title || "").trim();
  const hourlyRateCents = centsFromInput(body.hourlyRate || 0) || 0;
  const userId = String(body.userId || "").trim() || null;
  const active = parseBoolean(body.active, true);

  if (!name) return { error: "Member name is required." };
  return { value: { name, email: email || null, title: title || null, hourlyRateCents, userId, active } };
}

function validateTimesheet(body) {
  const memberId = Number(body.memberId);
  const workDate = String(body.workDate || "").trim();
  const hours = Number(body.hours);
  const hourlyRateCents = centsFromInput(body.hourlyRate || 0) || 0;
  const project = String(body.project || "").trim();
  const notes = String(body.notes || "").trim();
  const status = String(body.status || "submitted").trim();

  if (!Number.isFinite(memberId) || memberId <= 0) return { error: "Member is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: "Enter a valid work date." };
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return { error: "Hours must be between 0 and 24." };
  if (!["submitted", "approved", "paid"].includes(status)) return { error: "Choose a valid timesheet status." };

  return {
    value: {
      memberId,
      workDate,
      hours,
      hourlyRateCents,
      project: project || null,
      notes: notes || null,
      status
    }
  };
}

function validateMemberPayment(body) {
  const memberId = Number(body.memberId);
  const paidOn = String(body.paidOn || "").trim();
  const amountCents = centsFromInput(body.amount);
  const paymentAccountId = Number(body.paymentAccountId);
  const expenseAccountId = Number(body.expenseAccountId);
  const periodStart = String(body.periodStart || "").trim();
  const periodEnd = String(body.periodEnd || "").trim();
  const reference = String(body.reference || "").trim();
  const notes = String(body.notes || "").trim();

  if (!Number.isFinite(memberId) || memberId <= 0) return { error: "Member is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Enter a valid payment date." };
  if (!amountCents) return { error: "Payment amount must be greater than zero." };
  if (!Number.isFinite(paymentAccountId) || paymentAccountId <= 0) return { error: "Payment account is required." };
  if (!Number.isFinite(expenseAccountId) || expenseAccountId <= 0) return { error: "Expense account is required." };

  return {
    value: {
      memberId,
      paidOn,
      amountCents,
      paymentAccountId,
      expenseAccountId,
      periodStart: /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? periodStart : null,
      periodEnd: /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ? periodEnd : null,
      reference: reference || null,
      notes: notes || null
    }
  };
}

function validateSubscription(body) {
  const vendor = String(body.vendor || "").trim();
  const description = String(body.description || "").trim();
  const amountCents = centsFromInput(body.amount);
  const paymentAccountId = Number(body.paymentAccountId);
  const expenseAccountId = Number(body.expenseAccountId);
  const frequencyEvery = Number(body.frequencyEvery || 1);
  const frequencyUnit = String(body.frequencyUnit || "").trim();
  const startOn = String(body.startOn || "").trim();
  const nextDueOn = String(body.nextDueOn || "").trim();
  const endOn = String(body.endOn || "").trim();
  const reference = String(body.reference || "").trim();
  const notes = String(body.notes || "").trim();
  const active = parseBoolean(body.active, true);

  if (!vendor) return { error: "Vendor is required." };
  if (!description) return { error: "Description is required." };
  if (!amountCents) return { error: "Amount must be greater than zero." };
  if (!Number.isFinite(paymentAccountId) || paymentAccountId <= 0) return { error: "Payment account is required." };
  if (!Number.isFinite(expenseAccountId) || expenseAccountId <= 0) return { error: "Expense account is required." };
  if (!Number.isInteger(frequencyEvery) || frequencyEvery <= 0 || frequencyEvery > 365) return { error: "Repeat every must be between 1 and 365." };
  if (!recurrenceUnits.includes(frequencyUnit)) return { error: "Choose day, week, month, or year." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn)) return { error: "Enter a valid start date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueOn)) return { error: "Enter a valid next due date." };

  return {
    value: {
      vendor,
      description,
      amountCents,
      paymentAccountId,
      expenseAccountId,
      frequencyEvery,
      frequencyUnit,
      startOn,
      nextDueOn,
      endOn: /^\d{4}-\d{2}-\d{2}$/.test(endOn) ? endOn : null,
      reference: reference || null,
      notes: notes || null,
      active
    }
  };
}

async function validateTransaction(body, store) {
  const type = String(body.type || "").trim();
  const amountCents = centsFromInput(body.amount);
  const occurredOn = String(body.occurredOn || "").trim();
  const party = String(body.party || "").trim();
  const description = String(body.description || "").trim();
  const reference = String(body.reference || "").trim();
  const paymentAccountId = Number(body.paymentAccountId);
  const categoryAccountId = Number(body.categoryAccountId);

  if (!transactionTypes.includes(type)) return { error: "Choose income or expense." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return { error: "Enter a valid date." };
  if (!party) return { error: "Party is required." };
  if (!description) return { error: "Description is required." };
  if (!amountCents) return { error: "Amount must be greater than zero." };

  const paymentAccount = await store.getAccount(paymentAccountId);
  const categoryAccount = await store.getAccount(categoryAccountId);

  if (!paymentAccount || paymentAccount.type !== "asset" || !paymentAccount.active) {
    return { error: "Payment account must be an active asset account." };
  }

  const expectedCategory = type === "income" ? "revenue" : "expense";
  if (!categoryAccount || categoryAccount.type !== expectedCategory || !categoryAccount.active) {
    return { error: `Category account must be an active ${expectedCategory} account.` };
  }

  return {
    value: {
      type,
      amountCents,
      occurredOn,
      party,
      description,
      reference,
      paymentAccountId,
      categoryAccountId
    }
  };
}

function normalizeSupabaseError(error) {
  if (!error) return null;
  if (error.code === "23505") return "That record already exists.";
  if (error.code === "42P01") {
    return "Supabase tables are missing. Run npx prisma migrate dev --name init_bookkeeper first.";
  }
  return error.message || "Supabase request failed.";
}

class SupabaseStore {
  constructor() {
    this.provider = "supabase";
    this.configured = hasSupabaseConfig;
    if (!this.configured) return;

    this.admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    this.auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  ensureConfigured() {
    if (!this.configured) {
      throw Object.assign(new Error("Supabase is not configured. Fill in .env first."), { status: 503 });
    }
  }

  async init() {
    if (!this.configured) return;
    const { count, error } = await this.admin
      .from("accounts")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(normalizeSupabaseError(error));

    if (count === 0) {
      const rows = defaultAccounts.map(([code, name, type]) => ({ code, name, type }));
      const { error: insertError } = await this.admin.from("accounts").insert(rows);
      if (insertError) throw new Error(normalizeSupabaseError(insertError));
    }
  }

  async currentUser(id) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("users")
      .select("id, name, email, role, active, created_at")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(normalizeSupabaseError(error));
    return data;
  }

  async login(email, password) {
    this.ensureConfigured();
    const { data: authData, error } = await this.auth.auth.signInWithPassword({ email, password });
    if (error || !authData?.user) {
      throw Object.assign(new Error("Email or password is incorrect."), { status: 401 });
    }

    const user = await this.currentUser(authData.user.id);
    if (!user) {
      throw Object.assign(new Error("This account is not enabled for GoXAvni Bookkeeper."), { status: 403 });
    }

    return user;
  }

  async signup({ name, email, password, adminCode }) {
    this.ensureConfigured();
    if (signupCodesFromEnv().length === 0) {
      throw Object.assign(new Error("Sign-up codes are not configured."), { status: 503 });
    }

    const role = roleFromSignupCode(adminCode);
    if (!role) {
      throw Object.assign(new Error("Sign-up code is incorrect."), { status: 403 });
    }
    if (!name || !email || password.length < 8) {
      throw Object.assign(new Error("Name, email, and an 8+ character password are required."), { status: 400 });
    }

    const signupCodeHash = codeHash(String(adminCode).trim());
    const { data: usedCode, error: usedCodeError } = await this.admin
      .from("used_signup_codes")
      .select("code_hash")
      .eq("code_hash", signupCodeHash)
      .maybeSingle();
    if (usedCodeError) throw new Error(normalizeSupabaseError(usedCodeError));
    if (usedCode) {
      throw Object.assign(new Error("This sign-up code has already been used."), { status: 409 });
    }

    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    const profile = {
      id: data.user.id,
      name,
      email,
      role,
      active: true
    };
    const { data: user, error: profileError } = await this.admin
      .from("users")
      .insert(profile)
      .select("id, name, email, role, active, created_at")
      .single();
    if (profileError) throw new Error(normalizeSupabaseError(profileError));

    const { error: codeError } = await this.admin.from("used_signup_codes").insert({
      code_hash: signupCodeHash,
      role,
      used_by: data.user.id
    });
    if (codeError) throw Object.assign(new Error(normalizeSupabaseError(codeError)), { status: 409 });
    return user;
  }

  async listAccounts() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("accounts")
      .select("id, code, name, type, active")
      .order("code");
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map(cleanAccount);
  }

  async getAccount(id) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("accounts")
      .select("id, code, name, type, active")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(normalizeSupabaseError(error));
    return data ? cleanAccount(data) : null;
  }

  async createAccount(account) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("accounts")
      .insert(account)
      .select("id")
      .single();
    if (error) {
      const message = normalizeSupabaseError(error);
      throw Object.assign(new Error(message), { status: error.code === "23505" ? 409 : 400 });
    }
    return data.id;
  }

  async updateAccount(id, account) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("accounts")
      .update({
        code: account.code,
        name: account.name,
        type: account.type,
        active: account.active
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) {
      const message = normalizeSupabaseError(error);
      throw Object.assign(new Error(message), { status: error.code === "23505" ? 409 : 400 });
    }
    return data.id;
  }

  async listTransactions() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("transactions")
      .select(
        `
        id,
        occurred_on,
        type,
        party,
        description,
        reference,
        payment_account_id,
        category_account_id,
        amount_cents,
        payment:payment_account_id(name),
        category:category_account_id(name),
        creator:created_by(name)
      `
      )
      .order("occurred_on", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);
    if (error) throw new Error(normalizeSupabaseError(error));

    return data.map((transaction) => ({
      id: transaction.id,
      occurredOn: transaction.occurred_on,
      type: transaction.type,
      party: transaction.party,
      description: transaction.description,
      reference: transaction.reference,
      paymentAccountId: transaction.payment_account_id,
      categoryAccountId: transaction.category_account_id,
      amountCents: transaction.amount_cents,
      amount: formatMoney(transaction.amount_cents),
      paymentAccount: transaction.payment?.name || "",
      categoryAccount: transaction.category?.name || "",
      createdBy: transaction.creator?.name || ""
    }));
  }

  async createTransaction(tx, userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("transactions")
      .insert({
        occurred_on: tx.occurredOn,
        type: tx.type,
        party: tx.party,
        description: tx.description,
        reference: tx.reference || null,
        payment_account_id: tx.paymentAccountId,
        category_account_id: tx.categoryAccountId,
        amount_cents: tx.amountCents,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.id;
  }

  async updateTransaction(id, tx) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("transactions")
      .update({
        occurred_on: tx.occurredOn,
        type: tx.type,
        party: tx.party,
        description: tx.description,
        reference: tx.reference || null,
        payment_account_id: tx.paymentAccountId,
        category_account_id: tx.categoryAccountId,
        amount_cents: tx.amountCents
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async summary() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("transactions")
      .select("type, amount_cents, category:category_account_id(name, type)");
    if (error) throw new Error(normalizeSupabaseError(error));

    const totals = data.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") acc.incomeCents += transaction.amount_cents;
        if (transaction.type === "expense") acc.expenseCents += transaction.amount_cents;
        acc.transactionCount += 1;
        const categoryName = transaction.category?.name || "Uncategorized";
        const current = acc.categories.get(categoryName) || {
          name: categoryName,
          type: transaction.category?.type || transaction.type,
          amountCents: 0
        };
        current.amountCents += transaction.amount_cents;
        acc.categories.set(categoryName, current);
        return acc;
      },
      { incomeCents: 0, expenseCents: 0, transactionCount: 0, categories: new Map() }
    );

    return {
      summary: {
        income: formatMoney(totals.incomeCents),
        expenses: formatMoney(totals.expenseCents),
        net: formatMoney(totals.incomeCents - totals.expenseCents),
        transactionCount: totals.transactionCount
      },
      categories: [...totals.categories.values()]
        .sort((a, b) => b.amountCents - a.amountCents)
        .slice(0, 8)
        .map((category) => ({ ...category, amount: formatMoney(category.amountCents) }))
    };
  }

  async listUsers(actorRole = "member") {
    this.ensureConfigured();
    let query = this.admin
      .from("users")
      .select("id, name, email, role, active, created_at")
      .order("created_at", { ascending: false });
    if (actorRole === "manager") query = query.eq("role", "member");
    const { data, error } = await query;
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((user) => ({ ...user, createdAt: user.created_at }));
  }

  async createUser({ name, email, password, role, actorRole }) {
    this.ensureConfigured();
    if (!name || !email || password.length < 8 || !roles.includes(role)) {
      throw Object.assign(new Error("Name, email, role, and an 8+ character password are required."), { status: 400 });
    }
    if (!canManageRole(actorRole, role)) {
      throw Object.assign(new Error("Your role cannot create that user role."), { status: 403 });
    }

    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    const { error: profileError } = await this.admin.from("users").insert({
      id: data.user.id,
      name,
      email,
      role,
      active: true
    });
    if (profileError) throw Object.assign(new Error(normalizeSupabaseError(profileError)), { status: 400 });
    return data.user.id;
  }

  async updateUser({ id, name, email, role, active, actorRole, actorId }) {
    this.ensureConfigured();
    if (!name || !email || !roles.includes(role)) {
      throw Object.assign(new Error("Name, email, role, and status are required."), { status: 400 });
    }
    if (!canManageRole(actorRole, role)) {
      throw Object.assign(new Error("Your role cannot assign that user role."), { status: 403 });
    }

    const current = await this.currentUser(id);
    if (!current && id === actorId) {
      throw Object.assign(new Error("You cannot disable your current session."), { status: 400 });
    }
    if (actorRole === "manager") {
      const { data: target, error: targetError } = await this.admin
        .from("users")
        .select("role")
        .eq("id", id)
        .maybeSingle();
      if (targetError) throw new Error(normalizeSupabaseError(targetError));
      if (target?.role !== "member") {
        throw Object.assign(new Error("Managers can only edit member users."), { status: 403 });
      }
    }
    if (id === actorId && (!active || role !== actorRole)) {
      throw Object.assign(new Error("You cannot change your own role or disable yourself."), { status: 400 });
    }

    const { error: authError } = await this.admin.auth.admin.updateUserById(id, {
      email,
      user_metadata: { name }
    });
    if (authError) throw Object.assign(new Error(authError.message), { status: 400 });

    const { data, error } = await this.admin
      .from("users")
      .update({ name, email, role, active })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async listMembers() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("members")
      .select("id, user_id, name, email, title, hourly_rate_cents, active, created_at")
      .order("active", { ascending: false })
      .order("name");
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((member) => ({
      id: member.id,
      userId: member.user_id,
      name: member.name,
      email: member.email,
      title: member.title,
      hourlyRateCents: member.hourly_rate_cents,
      hourlyRate: formatMoney(member.hourly_rate_cents),
      active: member.active,
      createdAt: member.created_at
    }));
  }

  async getMember(id) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("members")
      .select("id, user_id, name, email, title, hourly_rate_cents, active")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(normalizeSupabaseError(error));
    return data;
  }

  async createMember(member, userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("members")
      .insert({
        user_id: member.userId,
        name: member.name,
        email: member.email,
        title: member.title,
        hourly_rate_cents: member.hourlyRateCents,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async updateMember(id, member) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("members")
      .update({
        user_id: member.userId,
        name: member.name,
        email: member.email,
        title: member.title,
        hourly_rate_cents: member.hourlyRateCents,
        active: member.active
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async listTimesheets({ from, to } = {}) {
    this.ensureConfigured();
    let query = this.admin
      .from("timesheets")
      .select("id, member_id, work_date, hours, hourly_rate_cents, project, notes, status, created_at, member:member_id(name)")
      .order("work_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (from) query = query.gte("work_date", from);
    if (to) query = query.lte("work_date", to);
    const { data, error } = await query;
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((row) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member?.name || "",
      workDate: row.work_date,
      hours: Number(row.hours),
      hourlyRateCents: row.hourly_rate_cents,
      hourlyRate: formatMoney(row.hourly_rate_cents),
      amount: formatMoney(Math.round(Number(row.hours) * row.hourly_rate_cents)),
      project: row.project,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at
    }));
  }

  async createTimesheet(timesheet, userId) {
    this.ensureConfigured();
    const member = await this.getMember(timesheet.memberId);
    if (!member || !member.active) {
      throw Object.assign(new Error("Choose an active member."), { status: 400 });
    }
    const hourlyRateCents = timesheet.hourlyRateCents || member.hourly_rate_cents || 0;
    const { data, error } = await this.admin
      .from("timesheets")
      .insert({
        member_id: timesheet.memberId,
        work_date: timesheet.workDate,
        hours: timesheet.hours,
        hourly_rate_cents: hourlyRateCents,
        project: timesheet.project,
        notes: timesheet.notes,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async updateTimesheet(id, timesheet, userId) {
    this.ensureConfigured();
    const member = await this.getMember(timesheet.memberId);
    if (!member || !member.active) {
      throw Object.assign(new Error("Choose an active member."), { status: 400 });
    }
    const hourlyRateCents = timesheet.hourlyRateCents || member.hourly_rate_cents || 0;
    const patch = {
      member_id: timesheet.memberId,
      work_date: timesheet.workDate,
      hours: timesheet.hours,
      hourly_rate_cents: hourlyRateCents,
      project: timesheet.project,
      notes: timesheet.notes,
      status: timesheet.status
    };
    if (timesheet.status === "approved") {
      patch.approved_by = userId;
      patch.approved_at = new Date().toISOString();
    }
    if (timesheet.status === "submitted") {
      patch.approved_by = null;
      patch.approved_at = null;
    }
    const { data, error } = await this.admin
      .from("timesheets")
      .update(patch)
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async approveTimesheet(id, userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("timesheets")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq("id", id)
      .neq("status", "paid")
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async listMemberPayments({ from, to } = {}) {
    this.ensureConfigured();
    let query = this.admin
      .from("member_payments")
      .select("id, member_id, transaction_id, paid_on, amount_cents, payment_account_id, expense_account_id, period_start, period_end, reference, notes, member:member_id(name), payment:payment_account_id(name), expense:expense_account_id(name)")
      .order("paid_on", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (from) query = query.gte("paid_on", from);
    if (to) query = query.lte("paid_on", to);
    const { data, error } = await query;
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((payment) => ({
      id: payment.id,
      memberId: payment.member_id,
      transactionId: payment.transaction_id,
      paidOn: payment.paid_on,
      amountCents: payment.amount_cents,
      amount: formatMoney(payment.amount_cents),
      paymentAccountId: payment.payment_account_id,
      expenseAccountId: payment.expense_account_id,
      periodStart: payment.period_start,
      periodEnd: payment.period_end,
      reference: payment.reference,
      notes: payment.notes,
      memberName: payment.member?.name || "",
      paymentAccount: payment.payment?.name || "",
      expenseAccount: payment.expense?.name || ""
    }));
  }

  async createMemberPayment(payment, userId) {
    this.ensureConfigured();
    const member = await this.getMember(payment.memberId);
    if (!member || !member.active) {
      throw Object.assign(new Error("Choose an active member."), { status: 400 });
    }
    const paymentAccount = await this.getAccount(payment.paymentAccountId);
    const expenseAccount = await this.getAccount(payment.expenseAccountId);
    if (!paymentAccount || paymentAccount.type !== "asset") {
      throw Object.assign(new Error("Payment account must be an asset account."), { status: 400 });
    }
    if (!expenseAccount || expenseAccount.type !== "expense") {
      throw Object.assign(new Error("Payment category must be an expense account."), { status: 400 });
    }

    const description = `Member payment - ${member.name}`;
    const { data: transaction, error: transactionError } = await this.admin
      .from("transactions")
      .insert({
        occurred_on: payment.paidOn,
        type: "expense",
        party: member.name,
        description,
        reference: payment.reference,
        payment_account_id: payment.paymentAccountId,
        category_account_id: payment.expenseAccountId,
        amount_cents: payment.amountCents,
        created_by: userId
      })
      .select("id")
      .single();
    if (transactionError) throw Object.assign(new Error(normalizeSupabaseError(transactionError)), { status: 400 });

    const { data, error } = await this.admin
      .from("member_payments")
      .insert({
        member_id: payment.memberId,
        transaction_id: transaction.id,
        paid_on: payment.paidOn,
        amount_cents: payment.amountCents,
        payment_account_id: payment.paymentAccountId,
        expense_account_id: payment.expenseAccountId,
        period_start: payment.periodStart,
        period_end: payment.periodEnd,
        reference: payment.reference,
        notes: payment.notes,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async updateMemberPayment(id, payment) {
    this.ensureConfigured();
    const member = await this.getMember(payment.memberId);
    if (!member || !member.active) {
      throw Object.assign(new Error("Choose an active member."), { status: 400 });
    }
    const paymentAccount = await this.getAccount(payment.paymentAccountId);
    const expenseAccount = await this.getAccount(payment.expenseAccountId);
    if (!paymentAccount || paymentAccount.type !== "asset") {
      throw Object.assign(new Error("Payment account must be an asset account."), { status: 400 });
    }
    if (!expenseAccount || expenseAccount.type !== "expense") {
      throw Object.assign(new Error("Payment category must be an expense account."), { status: 400 });
    }

    const { data: current, error: currentError } = await this.admin
      .from("member_payments")
      .select("transaction_id")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw new Error(normalizeSupabaseError(currentError));
    if (!current) throw Object.assign(new Error("Member payment not found."), { status: 404 });

    if (current.transaction_id) {
      const { error: transactionError } = await this.admin
        .from("transactions")
        .update({
          occurred_on: payment.paidOn,
          type: "expense",
          party: member.name,
          description: `Member payment - ${member.name}`,
          reference: payment.reference,
          payment_account_id: payment.paymentAccountId,
          category_account_id: payment.expenseAccountId,
          amount_cents: payment.amountCents
        })
        .eq("id", current.transaction_id);
      if (transactionError) throw Object.assign(new Error(normalizeSupabaseError(transactionError)), { status: 400 });
    }

    const { data, error } = await this.admin
      .from("member_payments")
      .update({
        member_id: payment.memberId,
        paid_on: payment.paidOn,
        amount_cents: payment.amountCents,
        payment_account_id: payment.paymentAccountId,
        expense_account_id: payment.expenseAccountId,
        period_start: payment.periodStart,
        period_end: payment.periodEnd,
        reference: payment.reference,
        notes: payment.notes
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async listSubscriptions() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("subscriptions")
      .select("id, vendor, description, amount_cents, payment_account_id, expense_account_id, frequency_every, frequency_unit, start_on, next_due_on, end_on, reference, notes, active, payment:payment_account_id(name), expense:expense_account_id(name)")
      .order("active", { ascending: false })
      .order("next_due_on", { ascending: true })
      .order("vendor");
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((subscription) => ({
      id: subscription.id,
      vendor: subscription.vendor,
      description: subscription.description,
      amountCents: subscription.amount_cents,
      amount: formatMoney(subscription.amount_cents),
      paymentAccountId: subscription.payment_account_id,
      expenseAccountId: subscription.expense_account_id,
      frequencyEvery: subscription.frequency_every,
      frequencyUnit: subscription.frequency_unit,
      startOn: subscription.start_on,
      nextDueOn: subscription.next_due_on,
      endOn: subscription.end_on,
      reference: subscription.reference,
      notes: subscription.notes,
      active: subscription.active,
      paymentAccount: subscription.payment?.name || "",
      expenseAccount: subscription.expense?.name || ""
    }));
  }

  async validateSubscriptionAccounts(subscription) {
    const paymentAccount = await this.getAccount(subscription.paymentAccountId);
    const expenseAccount = await this.getAccount(subscription.expenseAccountId);
    if (!paymentAccount || paymentAccount.type !== "asset" || !paymentAccount.active) {
      throw Object.assign(new Error("Payment account must be an active asset account."), { status: 400 });
    }
    if (!expenseAccount || expenseAccount.type !== "expense" || !expenseAccount.active) {
      throw Object.assign(new Error("Expense category must be an active expense account."), { status: 400 });
    }
  }

  async createSubscription(subscription, userId) {
    this.ensureConfigured();
    await this.validateSubscriptionAccounts(subscription);
    const { data, error } = await this.admin
      .from("subscriptions")
      .insert({
        vendor: subscription.vendor,
        description: subscription.description,
        amount_cents: subscription.amountCents,
        payment_account_id: subscription.paymentAccountId,
        expense_account_id: subscription.expenseAccountId,
        frequency_every: subscription.frequencyEvery,
        frequency_unit: subscription.frequencyUnit,
        start_on: subscription.startOn,
        next_due_on: subscription.nextDueOn,
        end_on: subscription.endOn,
        reference: subscription.reference,
        notes: subscription.notes,
        active: subscription.active,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async updateSubscription(id, subscription) {
    this.ensureConfigured();
    await this.validateSubscriptionAccounts(subscription);
    const { data, error } = await this.admin
      .from("subscriptions")
      .update({
        vendor: subscription.vendor,
        description: subscription.description,
        amount_cents: subscription.amountCents,
        payment_account_id: subscription.paymentAccountId,
        expense_account_id: subscription.expenseAccountId,
        frequency_every: subscription.frequencyEvery,
        frequency_unit: subscription.frequencyUnit,
        start_on: subscription.startOn,
        next_due_on: subscription.nextDueOn,
        end_on: subscription.endOn,
        reference: subscription.reference,
        notes: subscription.notes,
        active: subscription.active
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async profitLossReport({ from, to } = {}) {
    this.ensureConfigured();
    let query = this.admin
      .from("transactions")
      .select("occurred_on, type, amount_cents, category:category_account_id(name, type)")
      .order("occurred_on", { ascending: false });
    if (from) query = query.gte("occurred_on", from);
    if (to) query = query.lte("occurred_on", to);
    const { data, error } = await query;
    if (error) throw new Error(normalizeSupabaseError(error));

    const categories = new Map();
    const totals = data.reduce(
      (acc, row) => {
        if (row.type === "income") acc.incomeCents += row.amount_cents;
        if (row.type === "expense") acc.expenseCents += row.amount_cents;
        const key = `${row.type}:${row.category?.name || "Uncategorized"}`;
        const current = categories.get(key) || {
          name: row.category?.name || "Uncategorized",
          type: row.type,
          amountCents: 0
        };
        current.amountCents += row.amount_cents;
        categories.set(key, current);
        return acc;
      },
      { incomeCents: 0, expenseCents: 0 }
    );

    return {
      from,
      to,
      income: formatMoney(totals.incomeCents),
      expenses: formatMoney(totals.expenseCents),
      net: formatMoney(totals.incomeCents - totals.expenseCents),
      categories: [...categories.values()]
        .sort((a, b) => b.amountCents - a.amountCents)
        .map((category) => ({ ...category, amount: formatMoney(category.amountCents) }))
    };
  }
}

const store = new SupabaseStore();

async function requireAuth(req, res, next) {
  try {
    const auth = decodeAuthCookie(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: "Sign in required." });
    }

    const user = await store.currentUser(auth.userId);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Sign in required." });
    }

    req.user = user;
    setAuthCookie(res, user.id);
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Your role does not allow that action." });
    }
    return next();
  };
}

app.get("/bookkeeper", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.get("/api/me", async (req, res, next) => {
  try {
    const auth = decodeAuthCookie(req);
    const user = auth?.userId ? await store.currentUser(auth.userId) : null;
    if (user) setAuthCookie(res, user.id);
    res.json({ user: publicUser(user), provider: store.provider, configured: store.configured });
  } catch (error) {
    next(error);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await store.login(email, password);
    setAuthCookie(res, user.id);
    return res.json({ user: publicUser(user), provider: store.provider });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const adminCode = String(req.body.adminCode || "").trim();
    const user = await store.signup({ name, email, password, adminCode });
    setAuthCookie(res, user.id);
    return res.status(201).json({ user: publicUser(user), provider: store.provider });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/accounts", requireAuth, async (_req, res, next) => {
  try {
    res.json({ accounts: await store.listAccounts() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/accounts", requireAuth, requireRole(["owner"]), async (req, res, next) => {
  try {
    const parsed = validateAccount(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.createAccount(parsed.value);
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/accounts/:id", requireAuth, requireRole(["owner"]), async (req, res, next) => {
  try {
    const parsed = validateAccount(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.updateAccount(Number(req.params.id), parsed.value);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/transactions", requireAuth, async (_req, res, next) => {
  try {
    res.json({ transactions: await store.listTransactions() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/transactions", requireAuth, requireRole(["owner", "manager", "member"]), async (req, res, next) => {
  try {
    const parsed = await validateTransaction(req.body, store);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.createTransaction(parsed.value, req.user.id);
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/transactions/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const parsed = await validateTransaction(req.body, store);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.updateTransaction(Number(req.params.id), parsed.value);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/summary", requireAuth, async (_req, res, next) => {
  try {
    res.json(await store.summary());
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    res.json({ users: await store.listUsers(req.user.role) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const id = await store.createUser({
      name: String(req.body.name || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      password: String(req.body.password || ""),
      role: String(req.body.role || "").trim(),
      actorRole: req.user.role
    });
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/users/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const id = await store.updateUser({
      id: String(req.params.id || "").trim(),
      name: String(req.body.name || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      role: String(req.body.role || "").trim(),
      active: parseBoolean(req.body.active, true),
      actorRole: req.user.role,
      actorId: req.user.id
    });
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/members", requireAuth, async (_req, res, next) => {
  try {
    res.json({ members: await store.listMembers() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/members", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const parsed = validateMember(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.createMember(parsed.value, req.user.id);
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/members/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const parsed = validateMember(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.updateMember(Number(req.params.id), parsed.value);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/timesheets", requireAuth, async (req, res, next) => {
  try {
    res.json({ timesheets: await store.listTimesheets(dateRangeFromQuery(req.query)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/timesheets", requireAuth, requireRole(["owner", "manager", "member"]), async (req, res, next) => {
  try {
    const parsed = validateTimesheet(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.createTimesheet(parsed.value, req.user.id);
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/timesheets/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const parsed = validateTimesheet(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.updateTimesheet(Number(req.params.id), parsed.value, req.user.id);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/timesheets/:id/approve", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const id = await store.approveTimesheet(Number(req.params.id), req.user.id);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/member-payments", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    res.json({ payments: await store.listMemberPayments(dateRangeFromQuery(req.query)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/member-payments", requireAuth, requireRole(["owner"]), async (req, res, next) => {
  try {
    const parsed = validateMemberPayment(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.createMemberPayment(parsed.value, req.user.id);
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/member-payments/:id", requireAuth, requireRole(["owner"]), async (req, res, next) => {
  try {
    const parsed = validateMemberPayment(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.updateMemberPayment(Number(req.params.id), parsed.value);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/subscriptions", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
  try {
    res.json({ subscriptions: await store.listSubscriptions() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscriptions", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const parsed = validateSubscription(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.createSubscription(parsed.value, req.user.id);
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/subscriptions/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const parsed = validateSubscription(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const id = await store.updateSubscription(Number(req.params.id), parsed.value);
    return res.json({ id });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/reports/profit-loss", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    res.json({ report: await store.profitLossReport(dateRangeFromQuery(req.query)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/transactions.csv", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
  try {
    const transactions = await store.listTransactions();
    sendCsv(res, "goxavni-transactions.csv", [
      ["Date", "Type", "Party", "Description", "Category", "Payment Account", "Reference", "Amount"],
      ...transactions.map((tx) => [
        tx.occurredOn,
        tx.type,
        tx.party,
        tx.description,
        tx.categoryAccount,
        tx.paymentAccount,
        tx.reference || "",
        tx.amount
      ])
    ]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/timesheets.csv", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const timesheets = await store.listTimesheets(dateRangeFromQuery(req.query));
    sendCsv(res, "goxavni-timesheets.csv", [
      ["Date", "Member", "Project", "Hours", "Rate", "Amount", "Status", "Notes"],
      ...timesheets.map((entry) => [
        entry.workDate,
        entry.memberName,
        entry.project || "",
        entry.hours,
        entry.hourlyRate,
        entry.amount,
        entry.status,
        entry.notes || ""
      ])
    ]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/member-payments.csv", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
  try {
    const payments = await store.listMemberPayments(dateRangeFromQuery(req.query));
    sendCsv(res, "goxavni-member-payments.csv", [
      ["Paid On", "Member", "Amount", "Payment Account", "Expense Account", "Period Start", "Period End", "Reference", "Notes"],
      ...payments.map((payment) => [
        payment.paidOn,
        payment.memberName,
        payment.amount,
        payment.paymentAccount,
        payment.expenseAccount,
        payment.periodStart || "",
        payment.periodEnd || "",
        payment.reference || "",
        payment.notes || ""
      ])
    ]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/subscriptions.csv", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
  try {
    const subscriptions = await store.listSubscriptions();
    sendCsv(res, "goxavni-subscriptions.csv", [
      ["Vendor", "Description", "Amount", "Expense Account", "Payment Account", "Every", "Unit", "Start", "Next Due", "End", "Status", "Reference", "Notes"],
      ...subscriptions.map((subscription) => [
        subscription.vendor,
        subscription.description,
        subscription.amount,
        subscription.expenseAccount,
        subscription.paymentAccount,
        subscription.frequencyEvery,
        subscription.frequencyUnit,
        subscription.startOn,
        subscription.nextDueOn,
        subscription.endOn || "",
        subscription.active ? "Active" : "Inactive",
        subscription.reference || "",
        subscription.notes || ""
      ])
    ]);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: status === 500 ? "Something went wrong." : error.message });
});

await store.init();

if (process.argv[1] === __filename) {
  app.listen(port, () => {
    console.log(`GoXAvni site and bookkeeper running at http://localhost:${port}`);
    console.log(`Data provider: ${store.provider}`);
    if (!store.configured) console.log("Supabase is not configured. Fill in .env to enable the bookkeeper APIs.");
  });
}

export default app;
export { app };

