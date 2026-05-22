import { sendValidationError } from "../errors.js";
import { validateReminder } from "../validators.js";
import { dateRangeFromQuery, parseBoolean } from "../utils.js";

export function registerRemindersRoutes(app, { store, requireAuth }) {
  app.get("/api/reminders", requireAuth, async (req, res, next) => {
    try {
      const range = dateRangeFromQuery(req.query);
      const includeDone = parseBoolean(req.query.includeDone, true);
      res.json({ reminders: await store.listReminders({ ...range, includeDone, actor: req.user }) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reminders", requireAuth, async (req, res, next) => {
    try {
      const parsed = validateReminder(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createReminder(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "reminder", entityId: id, summary: parsed.value.title });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/reminders/:id", requireAuth, async (req, res, next) => {
    try {
      const parsed = validateReminder(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateReminder(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "reminder", entityId: id, summary: parsed.value.title });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/reminders/:id", requireAuth, async (req, res, next) => {
    try {
      const id = await store.deleteRecord("reminders", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "reminder", entityId: id, summary: "Reminder deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
