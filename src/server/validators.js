import crypto from "node:crypto";
import { accountTypes, recurrenceUnits, transactionTypes } from "./config.js";
import { centsFromInput, parseBoolean } from "./utils.js";

export function codeHash(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function signupCodesFromEnv() {
  return [
    ["owner", process.env.OWNER_SIGNUP_CODE],
    ["manager", process.env.MANAGER_SIGNUP_CODE],
    ["member", process.env.MEMBER_SIGNUP_CODE]
  ]
    .map(([role, code]) => ({ role, code: String(code || "").trim() }))
    .filter((entry) => entry.code.length >= 32);
}

export function roleFromSignupCode(inputCode) {
  const code = String(inputCode || "").trim();
  if (!code) return null;

  const inputHash = codeHash(code);
  return signupCodesFromEnv().find((entry) => {
    const expected = Buffer.from(codeHash(entry.code), "hex");
    const actual = Buffer.from(inputHash, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  })?.role || null;
}

export function validateAccount(body) {
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  const type = String(body.type || "").trim();
  const active = parseBoolean(body.active, true);

  if (!code || !name || !accountTypes.includes(type)) {
    return { error: "Account code, name, and type are required." };
  }

  return { value: { code, name, type, active } };
}

export function validateMember(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const title = String(body.title || "").trim();
  const hourlyRateCents = centsFromInput(body.hourlyRate || 0) || 0;
  const userId = String(body.userId || "").trim() || null;
  const active = parseBoolean(body.active, true);

  if (!name) return { error: "Member name is required." };
  return { value: { name, email: email || null, title: title || null, hourlyRateCents, userId, active } };
}

export function validateTimesheet(body) {
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

export function validateMemberPayment(body) {
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

export function validateSubscription(body) {
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

export async function validateTransaction(body, store) {
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
