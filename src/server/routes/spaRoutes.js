import path from "node:path";
import { distDir } from "../config.js";


export function registerSpaRoutes(app) {
  app.get("/bookkeeper", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}
