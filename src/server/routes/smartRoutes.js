export function registerSmartRoutes(app, { store, requireAuth }) {
  app.get("/api/smart", requireAuth, async (_req, res, next) => {
    try {
      res.json({ smart: await store.smartInsights() });
    } catch (error) {
      next(error);
    }
  });
}
