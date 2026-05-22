import { sendValidationError } from "../errors.js";
import { validateInvoice } from "../validators.js";

export function registerInvoicesRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/invoices", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      res.json({ invoices: await store.listInvoices() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/invoices", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateInvoice(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createInvoice(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "invoice", entityId: id, summary: parsed.value.invoiceNumber });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/invoices/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateInvoice(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateInvoice(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "invoice", entityId: id, summary: parsed.value.invoiceNumber });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/invoices/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.deleteRecord("invoices", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "invoice", entityId: id, summary: "Invoice deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/invoices/:id/mark-paid", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const transactionId = await store.markInvoicePaid(Number(req.params.id), req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "mark_paid", entityType: "invoice", entityId: req.params.id, summary: `Transaction ${transactionId}` });
      return res.json({ transactionId });
    } catch (error) {
      return next(error);
    }
  });
}
