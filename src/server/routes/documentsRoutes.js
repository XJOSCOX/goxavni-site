import { sendValidationError } from "../errors.js";
import { validateDocument } from "../validators.js";

export function registerDocumentsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/documents", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      res.json({ documents: await store.listDocuments() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateDocument(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createDocument(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "document", entityId: id, summary: parsed.value.label });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
