import { clearAuthCookie, decodeAuthCookie, setAuthCookie } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { publicUser } from "../utils.js";

const loginLimit = rateLimit({
  name: "login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Try again in a few minutes."
});

const signupLimit = rateLimit({
  name: "signup",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many sign-up attempts. Try again later."
});

export function registerAuthRoutes(app, { store }) {
  app.get("/api/me", async (req, res, next) => {
    try {
      const auth = decodeAuthCookie(req);
      const user = auth?.userId ? await store.currentUser(auth.userId) : null;
      if (user) setAuthCookie(res, user.id);
      res.json({ user: publicUser(user), provider: store.provider, configured: store.configured });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/login", loginLimit, async (req, res, next) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const user = await store.login(email, password);
      setAuthCookie(res, user.id);
      return res.json({ user: publicUser(user), provider: store.provider });
    } catch (error) {
      return next(error);
    }
  });
  
  app.post("/api/signup", signupLimit, async (req, res, next) => {
    try {
      const name = String(req.body.name || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const adminCode = String(req.body.adminCode || "").trim();
      const user = await store.signup({ name, email, password, adminCode });
      await store.createAuditLog({ actorId: user.id, action: "signup", entityType: "user", entityId: user.id, summary: user.email });
      setAuthCookie(res, user.id);
      return res.status(201).json({ user: publicUser(user), provider: store.provider });
    } catch (error) {
      return next(error);
    }
  });
  
  app.post("/api/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });
}
