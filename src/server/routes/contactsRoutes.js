import { sendValidationError } from "../errors.js";
import { validateContact } from "../validators.js";

export function registerContactsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/contacts", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      res.json({ contacts: await store.listContacts() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/contacts", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateContact(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createContact(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "contact", entityId: id, summary: parsed.value.name });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/contacts/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateContact(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateContact(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "contact", entityId: id, summary: parsed.value.name });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
