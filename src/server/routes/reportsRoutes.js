import { dateRangeFromQuery, sendCsv } from "../utils.js";


export function registerReportsRoutes(app, { store, requireAuth, requireRole }) {
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
}
