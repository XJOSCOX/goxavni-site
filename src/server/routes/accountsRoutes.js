import { sendValidationError } from "../errors.js";
import { validateAccount } from "../validators.js";


export function registerAccountsRoutes(app, { store, requireAuth, requireRole }) {
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
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createAccount(parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "account", entityId: id, summary: parsed.value.name });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/accounts/:id", requireAuth, requireRole(["owner"]), async (req, res, next) => {
    try {
      const parsed = validateAccount(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateAccount(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "account", entityId: id, summary: parsed.value.name });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
