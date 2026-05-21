import { sendValidationError } from "../errors.js";
import { dateRangeFromQuery } from "../utils.js";
import { validateTimesheet } from "../validators.js";


export function registerTimesheetsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/timesheets", requireAuth, async (req, res, next) => {
    try {
      res.json({ timesheets: await store.listTimesheets({ ...dateRangeFromQuery(req.query), actor: req.user }) });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/timesheets", requireAuth, requireRole(["owner", "manager", "member"]), async (req, res, next) => {
    try {
      const parsed = validateTimesheet(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createTimesheet(parsed.value, req.user);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "timesheet", entityId: id, summary: parsed.value.workDate });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.patch("/api/timesheets/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateTimesheet(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateTimesheet(Number(req.params.id), parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "timesheet", entityId: id, summary: parsed.value.workDate });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
  
  app.post("/api/timesheets/:id/approve", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.approveTimesheet(Number(req.params.id), req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "approve", entityType: "timesheet", entityId: id, summary: "Timesheet approved" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
