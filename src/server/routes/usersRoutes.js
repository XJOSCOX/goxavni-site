import { parseBoolean } from "../utils.js";


export function registerUsersRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/users", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      res.json({ users: await store.listUsers(req.user.role) });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/users", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.createUser({
        name: String(req.body.name || "").trim(),
        email: String(req.body.email || "").trim().toLowerCase(),
        password: String(req.body.password || ""),
        role: String(req.body.role || "").trim(),
        actorRole: req.user.role
      });
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "user", entityId: id, summary: String(req.body.email || "").trim().toLowerCase() });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/users/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.updateUser({
        id: String(req.params.id || "").trim(),
        name: String(req.body.name || "").trim(),
        email: String(req.body.email || "").trim().toLowerCase(),
        role: String(req.body.role || "").trim(),
        active: parseBoolean(req.body.active, true),
        actorRole: req.user.role,
        actorId: req.user.id
      });
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "user", entityId: id, summary: String(req.body.email || "").trim().toLowerCase() });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
