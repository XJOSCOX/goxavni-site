export function registerHealthRoutes(app, { store }) {
  app.get("/api/health", async (_req, res) => {
    res.json({
      ok: true,
      provider: store.provider,
      configured: store.configured,
      requestId: res.locals.requestId
    });
  });

  app.get("/api/health/ready", async (_req, res, next) => {
    try {
      if (!store.configured) {
        return res.status(503).json({
          ok: false,
          error: "Supabase is not configured.",
          code: "supabase_not_configured",
          requestId: res.locals.requestId
        });
      }

      await store.checkReady();
      return res.json({
        ok: true,
        provider: store.provider,
        database: "ready",
        requestId: res.locals.requestId
      });
    } catch (error) {
      return next(error);
    }
  });
}
