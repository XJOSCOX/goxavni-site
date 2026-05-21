export function registerAuditRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/audit-logs", requireAuth, requireRole(["owner"]), async (_req, res, next) => {
    try {
      res.json({ auditLogs: await store.listAuditLogs() });
    } catch (error) {
      next(error);
    }
  });
}
