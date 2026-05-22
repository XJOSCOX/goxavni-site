import { dateRangeFromQuery, sendCsv } from "../utils.js";

function balanceSheetQuery(query) {
  const asOf = String(query.asOf || "").trim();
  return { asOf: /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : null };
}

export function registerReportsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/reports/profit-loss", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      res.json({ report: await store.profitLossReport(dateRangeFromQuery(req.query)) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/balance-sheet", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      res.json({ report: await store.balanceSheetReport(balanceSheetQuery(req.query)) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/cash-flow", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      res.json({ report: await store.cashFlowReport(dateRangeFromQuery(req.query)) });
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

  app.get("/api/reports/balance-sheet.csv", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const report = await store.balanceSheetReport(balanceSheetQuery(req.query));
      const rows = [
        ["Section", "Code", "Account", "Amount"],
        ...report.assets.map((row) => ["Assets", row.code, row.name, row.amount]),
        ...report.liabilities.map((row) => ["Liabilities", row.code, row.name, row.amount]),
        ...report.equity.map((row) => ["Equity", row.code, row.name, row.amount]),
        ["Total", "", "Assets", report.totals.assets],
        ["Total", "", "Liabilities and Equity", report.totals.liabilitiesAndEquity]
      ];
      sendCsv(res, "goxavni-balance-sheet.csv", rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/cash-flow.csv", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const report = await store.cashFlowReport(dateRangeFromQuery(req.query));
      sendCsv(res, "goxavni-cash-flow.csv", [
        ["Month", "Type", "Category", "Inflow", "Outflow", "Net"],
        ...report.rows.map((row) => [
          row.month,
          row.type,
          row.category,
          row.inflow,
          row.outflow,
          row.net
        ]),
        ["Total", "", "", report.inflows, report.outflows, report.net]
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

  app.get("/api/reports/reminders.csv", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const reminders = await store.listReminders({ ...dateRangeFromQuery(req.query), includeDone: true });
      sendCsv(res, "goxavni-reminders.csv", [
        ["Due Date", "Due Time", "Title", "Priority", "Status", "Created By", "Details"],
        ...reminders.map((reminder) => [
          reminder.dueOn,
          reminder.dueTime || "",
          reminder.title,
          reminder.priority,
          reminder.status,
          reminder.createdBy,
          reminder.details || ""
        ])
      ]);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/contacts.csv", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      const contacts = await store.listContacts();
      sendCsv(res, "goxavni-contacts.csv", [
        ["Type", "Name", "Company", "Email", "Phone", "Status", "Notes"],
        ...contacts.map((contact) => [
          contact.type,
          contact.name,
          contact.company || "",
          contact.email || "",
          contact.phone || "",
          contact.active ? "Active" : "Inactive",
          contact.notes || ""
        ])
      ]);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/invoices.csv", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      const invoices = await store.listInvoices();
      sendCsv(res, "goxavni-invoices.csv", [
        ["Invoice", "Customer", "Issue Date", "Due Date", "Status", "Amount", "Revenue Account", "Payment Account", "Transaction", "Description", "Notes"],
        ...invoices.map((invoice) => [
          invoice.invoiceNumber,
          invoice.customerName,
          invoice.issueOn,
          invoice.dueOn,
          invoice.status,
          invoice.amount,
          invoice.revenueAccount,
          invoice.paymentAccount,
          invoice.transactionId || "",
          invoice.description,
          invoice.notes || ""
        ])
      ]);
    } catch (error) {
      next(error);
    }
  });
}
