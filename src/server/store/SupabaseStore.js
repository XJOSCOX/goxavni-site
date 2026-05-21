import { createClient } from "@supabase/supabase-js";
import { defaultAccounts, hasSupabaseConfig, roles } from "../config.js";
import { canManageRole, cleanAccount, formatMoney, normalizeSupabaseError } from "../utils.js";
import { codeHash, roleFromSignupCode, signupCodesFromEnv } from "../validators.js";

const priorityScore = { urgent: 4, high: 3, normal: 2, low: 1 };

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function addRecurrence(dateValue, every, unit) {
  const next = parseDate(dateValue);
  if (unit === "day") next.setUTCDate(next.getUTCDate() + every);
  if (unit === "week") next.setUTCDate(next.getUTCDate() + every * 7);
  if (unit === "month") next.setUTCMonth(next.getUTCMonth() + every);
  if (unit === "year") next.setUTCFullYear(next.getUTCFullYear() + every);
  return dateString(next);
}

function defaultWindow() {
  const today = new Date();
  return {
    from: dateString(today),
    to: dateString(addDays(today, 45))
  };
}

function sortCalendarEvents(events) {
  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
  });
}

export class SupabaseStore {
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

  async checkReady() {
    this.ensureConfigured();
    const { error } = await this.admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw new Error(normalizeSupabaseError(error));
    return true;
  }

  async createAuditLog({ actorId, action, entityType, entityId, summary }) {
    this.ensureConfigured();
    const { error } = await this.admin.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      summary: summary || null
    });
    if (error) throw new Error(normalizeSupabaseError(error));
  }

  async listAuditLogs() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, summary, created_at, actor:actor_id(name, email, role)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      summary: entry.summary,
      createdAt: entry.created_at,
      actorName: entry.actor?.name || "",
      actorEmail: entry.actor?.email || "",
      actorRole: entry.actor?.role || ""
    }));
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
    if (profileError) {
      await this.admin.auth.admin.deleteUser(data.user.id).catch(() => {});
      throw Object.assign(new Error(normalizeSupabaseError(profileError)), { status: 400 });
    }

    const { error: codeError } = await this.admin.from("used_signup_codes").insert({
      code_hash: signupCodeHash,
      role,
      used_by: data.user.id
    });
    if (codeError) {
      await this.admin.from("users").delete().eq("id", data.user.id);
      await this.admin.auth.admin.deleteUser(data.user.id).catch(() => {});
      throw Object.assign(new Error(normalizeSupabaseError(codeError)), { status: 409 });
    }
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

  async listTransactions({ actor } = {}) {
    this.ensureConfigured();
    let query = this.admin
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
    if (actor?.role === "member") query = query.eq("created_by", actor.id);
    const { data, error } = await query;
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

  async summary({ actor } = {}) {
    this.ensureConfigured();
    let query = this.admin
      .from("transactions")
      .select("type, amount_cents, category:category_account_id(name, type)");
    if (actor?.role === "member") query = query.eq("created_by", actor.id);
    const { data, error } = await query;
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

  async getMemberForUser(userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("members")
      .select("id, user_id, name, email, title, hourly_rate_cents, active")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(normalizeSupabaseError(error));
    return data;
  }

  async listMembers(actor = null) {
    this.ensureConfigured();
    let query = this.admin
      .from("members")
      .select("id, user_id, name, email, title, hourly_rate_cents, active, created_at")
      .order("active", { ascending: false })
      .order("name");
    if (actor?.role === "member") query = query.eq("user_id", actor.id);
    const { data, error } = await query;
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

  async listTimesheets({ from, to, actor } = {}) {
    this.ensureConfigured();
    let query = this.admin
      .from("timesheets")
      .select("id, member_id, work_date, hours, hourly_rate_cents, project, notes, status, created_at, member:member_id(name)")
      .order("work_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (from) query = query.gte("work_date", from);
    if (to) query = query.lte("work_date", to);
    if (actor?.role === "member") {
      const member = await this.getMemberForUser(actor.id);
      if (!member) return [];
      query = query.eq("member_id", member.id);
    }
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

  async createTimesheet(timesheet, actor) {
    this.ensureConfigured();
    const userId = typeof actor === "string" ? actor : actor.id;
    if (actor?.role === "member") {
      const actorMember = await this.getMemberForUser(actor.id);
      if (!actorMember || Number(actorMember.id) !== Number(timesheet.memberId)) {
        throw Object.assign(new Error("Members can only enter time for themselves."), { status: 403 });
      }
    }
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

  async postSubscription(id, userId) {
    this.ensureConfigured();
    const { data: subscription, error: findError } = await this.admin
      .from("subscriptions")
      .select("id, vendor, description, amount_cents, payment_account_id, expense_account_id, frequency_every, frequency_unit, next_due_on, end_on, reference, active")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw new Error(normalizeSupabaseError(findError));
    if (!subscription) throw Object.assign(new Error("Subscription not found."), { status: 404 });
    if (!subscription.active) throw Object.assign(new Error("Subscription is inactive."), { status: 400 });

    const { data: transaction, error: transactionError } = await this.admin
      .from("transactions")
      .insert({
        occurred_on: subscription.next_due_on,
        type: "expense",
        party: subscription.vendor,
        description: subscription.description,
        reference: subscription.reference,
        payment_account_id: subscription.payment_account_id,
        category_account_id: subscription.expense_account_id,
        amount_cents: subscription.amount_cents,
        created_by: userId
      })
      .select("id")
      .single();
    if (transactionError) throw Object.assign(new Error(normalizeSupabaseError(transactionError)), { status: 400 });

    const nextDueOn = addRecurrence(subscription.next_due_on, subscription.frequency_every, subscription.frequency_unit);
    const shouldDeactivate = subscription.end_on && nextDueOn > subscription.end_on;
    const { error: updateError } = await this.admin
      .from("subscriptions")
      .update({
        next_due_on: nextDueOn,
        active: shouldDeactivate ? false : true
      })
      .eq("id", id);
    if (updateError) throw Object.assign(new Error(normalizeSupabaseError(updateError)), { status: 400 });

    return { transactionId: transaction.id, nextDueOn, active: !shouldDeactivate };
  }

  async listContacts() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("contacts")
      .select("id, type, name, email, phone, company, notes, active, created_at")
      .order("active", { ascending: false })
      .order("type")
      .order("name");
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((contact) => ({
      id: contact.id,
      type: contact.type,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      notes: contact.notes,
      active: contact.active,
      createdAt: contact.created_at
    }));
  }

  async getContact(id) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("contacts")
      .select("id, type, name, active")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(normalizeSupabaseError(error));
    return data;
  }

  async createContact(contact, userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("contacts")
      .insert({
        type: contact.type,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        notes: contact.notes,
        active: contact.active,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async updateContact(id, contact) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("contacts")
      .update({
        type: contact.type,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        notes: contact.notes,
        active: contact.active
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async validateInvoice(invoice) {
    const customer = await this.getContact(invoice.customerId);
    if (!customer || customer.type !== "customer" || !customer.active) {
      throw Object.assign(new Error("Choose an active customer."), { status: 400 });
    }
    const revenueAccount = await this.getAccount(invoice.revenueAccountId);
    const paymentAccount = await this.getAccount(invoice.paymentAccountId);
    if (!revenueAccount || revenueAccount.type !== "revenue" || !revenueAccount.active) {
      throw Object.assign(new Error("Revenue account must be active."), { status: 400 });
    }
    if (!paymentAccount || paymentAccount.type !== "asset" || !paymentAccount.active) {
      throw Object.assign(new Error("Payment account must be an active asset account."), { status: 400 });
    }
    return customer;
  }

  async listInvoices() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("invoices")
      .select("id, invoice_number, customer_id, issue_on, due_on, status, amount_cents, revenue_account_id, payment_account_id, transaction_id, description, notes, created_at, customer:customer_id(name), revenue:revenue_account_id(name), payment:payment_account_id(name)")
      .order("due_on", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customerId: invoice.customer_id,
      customerName: invoice.customer?.name || "",
      issueOn: invoice.issue_on,
      dueOn: invoice.due_on,
      status: invoice.status,
      amountCents: invoice.amount_cents,
      amount: formatMoney(invoice.amount_cents),
      revenueAccountId: invoice.revenue_account_id,
      paymentAccountId: invoice.payment_account_id,
      transactionId: invoice.transaction_id,
      description: invoice.description,
      notes: invoice.notes,
      revenueAccount: invoice.revenue?.name || "",
      paymentAccount: invoice.payment?.name || "",
      createdAt: invoice.created_at
    }));
  }

  async createInvoice(invoice, userId) {
    this.ensureConfigured();
    await this.validateInvoice(invoice);
    const { data, error } = await this.admin
      .from("invoices")
      .insert({
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        issue_on: invoice.issueOn,
        due_on: invoice.dueOn,
        status: invoice.status,
        amount_cents: invoice.amountCents,
        revenue_account_id: invoice.revenueAccountId,
        payment_account_id: invoice.paymentAccountId,
        description: invoice.description,
        notes: invoice.notes,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: error.code === "23505" ? 409 : 400 });
    return data.id;
  }

  async updateInvoice(id, invoice) {
    this.ensureConfigured();
    await this.validateInvoice(invoice);
    const { data, error } = await this.admin
      .from("invoices")
      .update({
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customerId,
        issue_on: invoice.issueOn,
        due_on: invoice.dueOn,
        status: invoice.status,
        amount_cents: invoice.amountCents,
        revenue_account_id: invoice.revenueAccountId,
        payment_account_id: invoice.paymentAccountId,
        description: invoice.description,
        notes: invoice.notes
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: error.code === "23505" ? 409 : 400 });
    return data.id;
  }

  async markInvoicePaid(id, userId) {
    this.ensureConfigured();
    const { data: invoice, error: findError } = await this.admin
      .from("invoices")
      .select("id, invoice_number, customer_id, due_on, status, amount_cents, revenue_account_id, payment_account_id, transaction_id, description, customer:customer_id(name)")
      .eq("id", id)
      .maybeSingle();
    if (findError) throw new Error(normalizeSupabaseError(findError));
    if (!invoice) throw Object.assign(new Error("Invoice not found."), { status: 404 });
    if (invoice.status === "paid" && invoice.transaction_id) return invoice.transaction_id;

    const { data: transaction, error: transactionError } = await this.admin
      .from("transactions")
      .insert({
        occurred_on: dateString(new Date()),
        type: "income",
        party: invoice.customer?.name || "Customer",
        description: invoice.description,
        reference: invoice.invoice_number,
        payment_account_id: invoice.payment_account_id,
        category_account_id: invoice.revenue_account_id,
        amount_cents: invoice.amount_cents,
        created_by: userId
      })
      .select("id")
      .single();
    if (transactionError) throw Object.assign(new Error(normalizeSupabaseError(transactionError)), { status: 400 });

    const { error: updateError } = await this.admin
      .from("invoices")
      .update({ status: "paid", transaction_id: transaction.id })
      .eq("id", id);
    if (updateError) throw Object.assign(new Error(normalizeSupabaseError(updateError)), { status: 400 });
    return transaction.id;
  }

  async listDocuments() {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("documents")
      .select("id, label, url, entity_type, entity_id, notes, created_at, creator:created_by(name)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((document) => ({
      id: document.id,
      label: document.label,
      url: document.url,
      entityType: document.entity_type,
      entityId: document.entity_id,
      notes: document.notes,
      createdAt: document.created_at,
      createdBy: document.creator?.name || ""
    }));
  }

  async createDocument(document, userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("documents")
      .insert({
        label: document.label,
        url: document.url,
        entity_type: document.entityType,
        entity_id: document.entityId,
        notes: document.notes,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async listReminders({ from, to, includeDone = true, actor } = {}) {
    this.ensureConfigured();
    let query = this.admin
      .from("reminders")
      .select("id, title, details, due_on, due_time, priority, status, completed_at, created_at, creator:created_by(name)")
      .order("due_on", { ascending: true })
      .order("due_time", { ascending: true })
      .order("priority", { ascending: false })
      .limit(400);
    if (from) query = query.gte("due_on", from);
    if (to) query = query.lte("due_on", to);
    if (!includeDone) query = query.eq("status", "open");
    if (actor?.role === "member") query = query.eq("created_by", actor.id);

    const { data, error } = await query;
    if (error) throw new Error(normalizeSupabaseError(error));
    return data.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      details: reminder.details,
      dueOn: reminder.due_on,
      dueTime: reminder.due_time,
      priority: reminder.priority,
      status: reminder.status,
      completedAt: reminder.completed_at,
      createdAt: reminder.created_at,
      createdBy: reminder.creator?.name || ""
    }));
  }

  async createReminder(reminder, userId) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("reminders")
      .insert({
        title: reminder.title,
        details: reminder.details,
        due_on: reminder.dueOn,
        due_time: reminder.dueTime,
        priority: reminder.priority,
        status: reminder.status,
        completed_at: reminder.status === "done" ? new Date().toISOString() : null,
        created_by: userId
      })
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async updateReminder(id, reminder) {
    this.ensureConfigured();
    const { data, error } = await this.admin
      .from("reminders")
      .update({
        title: reminder.title,
        details: reminder.details,
        due_on: reminder.dueOn,
        due_time: reminder.dueTime,
        priority: reminder.priority,
        status: reminder.status,
        completed_at: reminder.status === "done" ? new Date().toISOString() : null
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw Object.assign(new Error(normalizeSupabaseError(error)), { status: 400 });
    return data.id;
  }

  async calendarEvents({ from, to, actor } = {}) {
    this.ensureConfigured();
    const fallback = defaultWindow();
    const range = { from: from || fallback.from, to: to || fallback.to };
    const [reminders, subscriptions, invoices, transactions, timesheets, payments] = await Promise.all([
      this.listReminders({ from: range.from, to: range.to, includeDone: true, actor }),
      actor?.role === "member" ? [] : this.listSubscriptions(),
      actor?.role === "member" ? [] : this.listInvoices(),
      (() => {
        let query = this.admin
        .from("transactions")
        .select("id, occurred_on, type, party, description, amount_cents")
        .gte("occurred_on", range.from)
        .lte("occurred_on", range.to)
        .order("occurred_on", { ascending: true })
        .limit(300);
        if (actor?.role === "member") query = query.eq("created_by", actor.id);
        return query;
      })(),
      this.listTimesheets({ from: range.from, to: range.to, actor }),
      actor?.role === "member" ? { data: [], error: null } : this.admin
        .from("member_payments")
        .select("id, paid_on, amount_cents, member:member_id(name)")
        .gte("paid_on", range.from)
        .lte("paid_on", range.to)
        .order("paid_on", { ascending: true })
        .limit(300)
    ]);

    for (const result of [transactions, payments]) {
      if (result.error) throw new Error(normalizeSupabaseError(result.error));
    }

    const events = [
      ...reminders.map((reminder) => ({
        id: `reminder-${reminder.id}`,
        date: reminder.dueOn,
        time: reminder.dueTime,
        type: "reminder",
        title: reminder.title,
        detail: reminder.details || reminder.priority,
        status: reminder.status,
        priority: reminder.priority
      })),
      ...subscriptions
        .filter((subscription) => subscription.active && subscription.nextDueOn >= range.from && subscription.nextDueOn <= range.to)
        .map((subscription) => ({
          id: `subscription-${subscription.id}`,
          date: subscription.nextDueOn,
          type: "subscription",
          title: subscription.vendor,
          detail: subscription.description,
          amount: subscription.amount,
          status: "active"
        })),
      ...invoices
        .filter((invoice) => !["paid", "void"].includes(invoice.status) && invoice.dueOn >= range.from && invoice.dueOn <= range.to)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          date: invoice.dueOn,
          type: "invoice",
          title: invoice.invoiceNumber,
          detail: invoice.customerName,
          amount: invoice.amount,
          status: invoice.status
        })),
      ...transactions.data.map((transaction) => ({
        id: `transaction-${transaction.id}`,
        date: transaction.occurred_on,
        type: transaction.type,
        title: transaction.party,
        detail: transaction.description,
        amount: formatMoney(transaction.amount_cents),
        status: transaction.type
      })),
      ...timesheets.map((timesheet) => ({
        id: `timesheet-${timesheet.id}`,
        date: timesheet.workDate,
        type: "timesheet",
        title: timesheet.memberName || "Member",
        detail: timesheet.project || `${Number(timesheet.hours)} hours`,
        status: timesheet.status
      })),
      ...payments.data.map((payment) => ({
        id: `payment-${payment.id}`,
        date: payment.paid_on,
        type: "member payment",
        title: payment.member?.name || "Member",
        detail: "Member payment",
        amount: formatMoney(payment.amount_cents),
        status: "paid"
      }))
    ];

    return { ...range, events: sortCalendarEvents(events) };
  }

  async smartInsights(actor = null) {
    this.ensureConfigured();
    const today = dateString(new Date());
    const nextWeek = dateString(addDays(new Date(), 7));
    const nextTwoWeeks = dateString(addDays(new Date(), 14));
    const [dashboard, reminders, subscriptions, invoices, timesheets] = await Promise.all([
      this.summary({ actor }),
      this.listReminders({ includeDone: false, actor }),
      actor?.role === "member" ? [] : this.listSubscriptions(),
      actor?.role === "member" ? [] : this.listInvoices(),
      this.listTimesheets({ actor })
    ]);

    const overdueReminders = reminders
      .filter((reminder) => reminder.dueOn < today)
      .sort((a, b) => (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0));
    const dueSoonReminders = reminders.filter((reminder) => reminder.dueOn >= today && reminder.dueOn <= nextWeek);
    const upcomingSubscriptions = subscriptions.filter((subscription) => (
      subscription.active && subscription.nextDueOn >= today && subscription.nextDueOn <= nextTwoWeeks
    ));
    const pendingTimesheets = timesheets.filter((timesheet) => timesheet.status === "submitted");
    const overdueInvoices = invoices.filter((invoice) => !["paid", "void"].includes(invoice.status) && invoice.dueOn < today);
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.active);
    const recurringCents = activeSubscriptions.reduce((total, subscription) => total + Number(subscription.amountCents || 0), 0);

    const insights = [
      overdueReminders.length && {
        tone: "danger",
        title: "Overdue reminders",
        value: overdueReminders.length,
        action: "Review open finance tasks."
      },
      dueSoonReminders.length && {
        tone: "warning",
        title: "Due this week",
        value: dueSoonReminders.length,
        action: "Clear upcoming reminders before they become late."
      },
      upcomingSubscriptions.length && {
        tone: "info",
        title: "Recurring expenses due",
        value: upcomingSubscriptions.length,
        action: "Check account balance before the next charge dates."
      },
      pendingTimesheets.length && {
        tone: "info",
        title: "Timesheets waiting",
        value: pendingTimesheets.length,
        action: "Approve or update submitted hours."
      },
      overdueInvoices.length && {
        tone: "danger",
        title: "Overdue invoices",
        value: overdueInvoices.length,
        action: "Follow up with customers and mark paid when money arrives."
      },
      {
        tone: dashboard.summary.net < 0 ? "danger" : "good",
        title: "Current net",
        value: formatMoney(dashboard.summary.net * 100),
        action: dashboard.summary.net < 0 ? "Expenses are above income right now." : "Income is covering recorded expenses."
      }
    ].filter(Boolean);

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        overdueReminders: overdueReminders.length,
        dueSoonReminders: dueSoonReminders.length,
        upcomingSubscriptions: upcomingSubscriptions.length,
        pendingTimesheets: pendingTimesheets.length,
        overdueInvoices: overdueInvoices.length,
        activeSubscriptions: activeSubscriptions.length,
        recurringAmount: formatMoney(recurringCents)
      },
      insights,
      reminders: [...overdueReminders, ...dueSoonReminders].slice(0, 8),
      subscriptions: upcomingSubscriptions.slice(0, 8),
      invoices: overdueInvoices.slice(0, 8),
      timesheets: pendingTimesheets.slice(0, 8)
    };
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
