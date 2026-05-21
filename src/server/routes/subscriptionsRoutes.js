import { sendValidationError } from "../errors.js";
import { validateSubscription } from "../validators.js";


export function registerSubscriptionsRoutes(app, { store, requireAuth, requireRole }) {
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
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createSubscription(parsed.value, req.user.id);
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/subscriptions/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateSubscription(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateSubscription(Number(req.params.id), parsed.value);
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
