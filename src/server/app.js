import express from "express";
import helmet from "helmet";
import path from "node:path";
import { distDir, rootDir } from "./config.js";
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
app.use(express.json());
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/public", express.static(path.join(rootDir, "public")));
app.use(express.static(distDir));

registerRoutes(app, store);

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: status === 500 ? "Something went wrong." : error.message });
});

await store.init();

export default app;
