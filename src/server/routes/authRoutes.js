import { clearAuthCookie, decodeAuthCookie, setAuthCookie } from "../auth.js";
import { publicUser } from "../utils.js";


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
  
  app.post("/api/login", async (req, res, next) => {
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
  
  app.post("/api/signup", async (req, res, next) => {
    try {
      const name = String(req.body.name || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const adminCode = String(req.body.adminCode || "").trim();
      const user = await store.signup({ name, email, password, adminCode });
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
