export function registerSmartRoutes(app, { store, requireAuth }) {
  app.get("/api/smart", requireAuth, async (req, res, next) => {
    try {
      res.json({ smart: await store.smartInsights(req.user) });
    } catch (error) {
      next(error);
    }
  });
}
