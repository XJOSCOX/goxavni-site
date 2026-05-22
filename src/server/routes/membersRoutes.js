import { sendValidationError } from "../errors.js";
import { validateMember } from "../validators.js";


export function registerMembersRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/members", requireAuth, async (req, res, next) => {
    try {
      res.json({ members: await store.listMembers(req.user) });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/members", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateMember(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createMember(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "member", entityId: id, summary: parsed.value.name });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/members/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateMember(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateMember(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "member", entityId: id, summary: parsed.value.name });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/members/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.deleteRecord("members", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "member", entityId: id, summary: "Member deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
