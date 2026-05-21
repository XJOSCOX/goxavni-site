import { dateRangeFromQuery } from "../utils.js";

export function registerCalendarRoutes(app, { store, requireAuth }) {
  app.get("/api/calendar", requireAuth, async (req, res, next) => {
    try {
      res.json({ calendar: await store.calendarEvents({ ...dateRangeFromQuery(req.query), actor: req.user }) });
    } catch (error) {
      next(error);
    }
  });
}
