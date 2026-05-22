import crypto from "node:crypto";
import { accountTypes, contactTypes, invoiceStatuses, recurrenceUnits, reminderPriorities, reminderStatuses, transactionTypes } from "./config.js";
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

export function validateReminder(body) {
  const title = String(body.title || "").trim();
  const details = String(body.details || "").trim();
  const dueOn = String(body.dueOn || "").trim();
  const dueTime = String(body.dueTime || "").trim();
  const priority = String(body.priority || "normal").trim();
  const status = String(body.status || "open").trim();

  if (!title) return { error: "Reminder title is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { error: "Enter a valid reminder date." };
  if (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)) return { error: "Enter time as HH:MM." };
  if (!reminderPriorities.includes(priority)) return { error: "Choose a valid priority." };
  if (!reminderStatuses.includes(status)) return { error: "Choose a valid status." };

  return {
    value: {
      title,
      details: details || null,
      dueOn,
      dueTime: dueTime || null,
      priority,
      status
    }
  };
}

export function validateContact(body) {
  const type = String(body.type || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const company = String(body.company || "").trim();
  const notes = String(body.notes || "").trim();
  const active = parseBoolean(body.active, true);

  if (!contactTypes.includes(type)) return { error: "Choose customer or vendor." };
  if (!name) return { error: "Contact name is required." };

  return {
    value: {
      type,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      notes: notes || null,
      active
    }
  };
}

export function validateInvoice(body) {
  const invoiceNumber = String(body.invoiceNumber || "").trim();
  const customerId = Number(body.customerId);
  const issueOn = String(body.issueOn || "").trim();
  const dueOn = String(body.dueOn || "").trim();
  const status = String(body.status || "draft").trim();
  const amountCents = centsFromInput(body.amount);
  const revenueAccountId = Number(body.revenueAccountId);
  const paymentAccountId = Number(body.paymentAccountId);
  const description = String(body.description || "").trim();
  const notes = String(body.notes || "").trim();

  if (!invoiceNumber) return { error: "Invoice number is required." };
  if (!Number.isFinite(customerId) || customerId <= 0) return { error: "Customer is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueOn)) return { error: "Enter a valid issue date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { error: "Enter a valid due date." };
  if (!invoiceStatuses.includes(status)) return { error: "Choose a valid invoice status." };
  if (!amountCents) return { error: "Invoice amount must be greater than zero." };
  if (!Number.isFinite(revenueAccountId) || revenueAccountId <= 0) return { error: "Revenue account is required." };
  if (!Number.isFinite(paymentAccountId) || paymentAccountId <= 0) return { error: "Payment account is required." };
  if (!description) return { error: "Invoice description is required." };

  return {
    value: {
      invoiceNumber,
      customerId,
      issueOn,
      dueOn,
      status,
      amountCents,
      revenueAccountId,
      paymentAccountId,
      description,
      notes: notes || null
    }
  };
}

export function validateDocument(body) {
  const label = String(body.label || "").trim();
  const url = String(body.url || "").trim();
  const entityType = String(body.entityType || "").trim();
  const entityId = String(body.entityId || "").trim();
  const notes = String(body.notes || "").trim();

  if (!label) return { error: "Document label is required." };
  if (!/^https?:\/\/\S+$/i.test(url)) return { error: "Document URL must start with http:// or https://." };
  if (!entityType) return { error: "Document record type is required." };
  if (!entityId) return { error: "Document record id is required." };

  return {
    value: {
      label,
      url,
      entityType,
      entityId,
      notes: notes || null
    }
  };
}

export function validateDocumentUpload(body) {
  const base = validateDocument({ ...body, url: body.url || "https://uploaded.local/file" });
  if (base.error) return base;
  const filename = String(body.filename || "").trim();
  const contentType = String(body.contentType || "application/octet-stream").trim();
  const contentBase64 = String(body.contentBase64 || "").trim();

  if (!filename) return { error: "Filename is required." };
  if (!contentBase64) return { error: "File content is required." };

  return {
    value: {
      ...base.value,
      filename,
      contentType,
      contentBase64
    }
  };
}

export function validateMonthlyClose(body) {
  const period = String(body.period || "").trim();
  const closedOn = String(body.closedOn || "").trim();

  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Close period must be YYYY-MM." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closedOn)) return { error: "Close date is required." };

  return { value: { period, closedOn } };
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
