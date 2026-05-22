import { sendValidationError } from "../errors.js";
import { validateTransaction } from "../validators.js";


export function registerTransactionsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/transactions", requireAuth, async (req, res, next) => {
    try {
      res.json({ transactions: await store.listTransactions({ actor: req.user }) });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/transactions", requireAuth, requireRole(["owner", "manager", "member"]), async (req, res, next) => {
    try {
      const parsed = await validateTransaction(req.body, store);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createTransaction(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "transaction", entityId: id, summary: `${parsed.value.type} ${parsed.value.amountCents}` });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/transactions/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = await validateTransaction(req.body, store);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateTransaction(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "transaction", entityId: id, summary: `${parsed.value.type} ${parsed.value.amountCents}` });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/transactions/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.deleteRecord("transactions", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "transaction", entityId: id, summary: "Transaction deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.get("/api/summary", requireAuth, async (req, res, next) => {
    try {
      res.json(await store.summary({ actor: req.user }));
    } catch (error) {
      next(error);
    }
  });
}
