import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { activityRoutes } from "./routes/activities.js";
import { sessionRoutes } from "./routes/sessions.js";
import { startScheduler } from "./sync/scheduler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Loads the repo-root .env so this works both via `pnpm dev` (cwd=apps/api)
// and the built Docker image (cwd=/app), without duplicating env files.
config({ path: resolve(__dirname, "../../../.env") });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(activityRoutes);
await app.register(sessionRoutes);

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).then(() => {
  if (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    startScheduler();
  } else {
    app.log.warn("GARMIN_EMAIL/GARMIN_PASSWORD not set, sync scheduler disabled");
  }
});
