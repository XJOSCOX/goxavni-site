import { sendValidationError } from "../errors.js";
import { validateMonthlyClose } from "../validators.js";

export function registerCloseRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/monthly-closes", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      res.json({ monthlyCloses: await store.listMonthlyCloses() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/monthly-closes", requireAuth, requireRole(["owner"]), async (req, res, next) => {
    try {
      const parsed = validateMonthlyClose(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const period = await store.createMonthlyClose(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "close", entityType: "monthly_close", entityId: period, summary: `Closed ${period}` });
      return res.status(201).json({ period });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/monthly-closes/:id", requireAuth, requireRole(["owner"]), async (req, res, next) => {
    try {
      const id = await store.deleteRecord("monthly_closes", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "monthly_close", entityId: id, summary: "Monthly close deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
