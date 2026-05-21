import { validateReminder } from "../validators.js";
import { dateRangeFromQuery, parseBoolean } from "../utils.js";

export function registerRemindersRoutes(app, { store, requireAuth }) {
  app.get("/api/reminders", requireAuth, async (req, res, next) => {
    try {
      const range = dateRangeFromQuery(req.query);
      const includeDone = parseBoolean(req.query.includeDone, true);
      res.json({ reminders: await store.listReminders({ ...range, includeDone }) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reminders", requireAuth, async (req, res, next) => {
    try {
      const parsed = validateReminder(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const id = await store.createReminder(parsed.value, req.user.id);
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/reminders/:id", requireAuth, async (req, res, next) => {
    try {
      const parsed = validateReminder(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const id = await store.updateReminder(Number(req.params.id), parsed.value);
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
