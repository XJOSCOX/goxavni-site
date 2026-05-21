import { createRequireAuth, requireRole } from "./auth.js";
import { registerAccountsRoutes } from "./routes/accountsRoutes.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerCalendarRoutes } from "./routes/calendarRoutes.js";
import { registerHealthRoutes } from "./routes/healthRoutes.js";
import { registerMembersRoutes } from "./routes/membersRoutes.js";
import { registerPaymentsRoutes } from "./routes/paymentsRoutes.js";
import { registerReportsRoutes } from "./routes/reportsRoutes.js";
import { registerRemindersRoutes } from "./routes/remindersRoutes.js";
import { registerSmartRoutes } from "./routes/smartRoutes.js";
import { registerSpaRoutes } from "./routes/spaRoutes.js";
import { registerSubscriptionsRoutes } from "./routes/subscriptionsRoutes.js";
import { registerTimesheetsRoutes } from "./routes/timesheetsRoutes.js";
import { registerTransactionsRoutes } from "./routes/transactionsRoutes.js";
import { registerUsersRoutes } from "./routes/usersRoutes.js";

export function registerRoutes(app, store) {
  const context = { store, requireAuth: createRequireAuth(store), requireRole };

  registerSpaRoutes(app);
  registerHealthRoutes(app, context);
  registerAuthRoutes(app, context);
  registerAccountsRoutes(app, context);
  registerSmartRoutes(app, context);
  registerCalendarRoutes(app, context);
  registerRemindersRoutes(app, context);
  registerTransactionsRoutes(app, context);
  registerUsersRoutes(app, context);
  registerMembersRoutes(app, context);
  registerTimesheetsRoutes(app, context);
  registerPaymentsRoutes(app, context);
  registerSubscriptionsRoutes(app, context);
  registerReportsRoutes(app, context);
}
