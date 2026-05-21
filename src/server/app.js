import express from "express";
import helmet from "helmet";
import crypto from "node:crypto";
import path from "node:path";
import { distDir, rootDir } from "./config.js";
import { errorHandler, notFound } from "./errors.js";
import { registerRoutes } from "./routes.js";
import { SupabaseStore } from "./store/SupabaseStore.js";

export const app = express();
export const store = new SupabaseStore();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use((req, res, next) => {
  res.locals.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/public", express.static(path.join(rootDir, "public")));
app.use(express.static(distDir));

registerRoutes(app, store);
app.use("/api", notFound);

app.use(errorHandler);

await store.init();

export default app;
