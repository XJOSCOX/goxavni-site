import crypto from "node:crypto";
import { authCookieName, sessionMaxAgeMs, sessionSecret } from "./config.js";

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function encodeAuthCookie(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeAuthCookie(req) {
  const value = parseCookies(req)[authCookieName];
  if (!value) return null;

  const [body, signature] = value.split(".");
  if (!body || !signature || signature !== sign(body)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function setAuthCookie(res, userId) {
  res.cookie(authCookieName, encodeAuthCookie({ userId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionMaxAgeMs
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export function createRequireAuth(store) {
  return async function requireAuth(req, res, next) {
    try {
      const auth = decodeAuthCookie(req);
      if (!auth?.userId) {
        return res.status(401).json({
          error: "Sign in required.",
          code: "auth_required",
          requestId: res.locals.requestId
        });
      }

      const user = await store.currentUser(auth.userId);
      if (!user) {
        clearAuthCookie(res);
        return res.status(401).json({
          error: "Sign in required.",
          code: "auth_required",
          requestId: res.locals.requestId
        });
      }

      req.user = user;
      setAuthCookie(res, user.id);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Your role does not allow that action.",
        code: "role_forbidden",
        requestId: res.locals.requestId
      });
    }
    return next();
  };
}
