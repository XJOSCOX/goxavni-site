import { sendValidationError } from "../errors.js";
import { dateRangeFromQuery } from "../utils.js";
import { validateMemberPayment } from "../validators.js";


export function registerPaymentsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/member-payments", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      res.json({ payments: await store.listMemberPayments(dateRangeFromQuery(req.query)) });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/member-payments", requireAuth, requireRole(["owner"]), async (req, res, next) => {
    try {
      const parsed = validateMemberPayment(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createMemberPayment(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "member_payment", entityId: id, summary: `Member payment ${parsed.value.amountCents}` });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/member-payments/:id", requireAuth, requireRole(["owner"]), async (req, res, next) => {
    try {
      const parsed = validateMemberPayment(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateMemberPayment(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "member_payment", entityId: id, summary: `Member payment ${parsed.value.amountCents}` });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
