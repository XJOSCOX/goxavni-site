import { fileURLToPath } from "node:url";
import app, { store } from "./server/app.js";
import { port } from "./server/config.js";

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  app.listen(port, () => {
    console.log(`GoXAvni site and bookkeeper running at http://localhost:${port}`);
    console.log(`Data provider: ${store.provider}`);
    if (!store.configured) console.log("Supabase is not configured. Fill in .env to enable the bookkeeper APIs.");
  });
}

export default app;
export { app };
