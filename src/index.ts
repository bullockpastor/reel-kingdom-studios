import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import { config, STUDIO_NAME, STUDIO_TAGLINE } from "./config.js";
import { logger } from "./utils/logger.js";
import { ensureStudioRoot } from "./storage/studio-root.js";
import { runHealthChecks } from "./utils/health-check.js";
import { projectRoutes } from "./routes/projects.js";
import { shotRoutes } from "./routes/shots.js";
import { assetRoutes } from "./routes/assets.js";
import { queueRoutes } from "./routes/queue.js";
import { presenterRoutes } from "./routes/presenter.js";
import "./queue/render.worker.js";
import "./queue/assembly.worker.js";

const app = Fastify({ logger: false });

app.register(cors);

// Serve the React SPA from client/dist/
app.register(fastifyStatic, {
  root: join(process.cwd(), "client", "dist"),
  prefix: "/studio/",
  decorateReply: true,
  wildcard: false,
});

// SPA catch-all: /studio bare redirects to /studio/
app.get("/studio", async (_request, reply) => {
  return reply.redirect("/studio/");
});

// SPA fallback: any /studio/* path that isn't a static asset serves index.html
// Must be an explicit route (not setNotFoundHandler) so it runs in the same scope
// as the @fastify/static registration and reply.sendFile is available.
app.get("/studio/*", async (_request, reply) => {
  return reply.sendFile("index.html");
});

app.setNotFoundHandler(async (_request, reply) => {
  reply.status(404).send({ error: "Not found" });
});

// Health check — full dependency status
app.get("/health", async () => {
  const { healthy, services } = await runHealthChecks();
  return { studio: STUDIO_NAME, tagline: STUDIO_TAGLINE, healthy, services, timestamp: new Date().toISOString() };
});

// API Routes
app.register(projectRoutes, { prefix: "/projects" });
app.register(shotRoutes, { prefix: "/shots" });
app.register(assetRoutes, { prefix: "/assets" });
app.register(queueRoutes, { prefix: "/queue" });
app.register(presenterRoutes, { prefix: "/presenter" });

// Global error handler
app.setErrorHandler((error: Error, _request, reply) => {
  logger.error({ err: error }, "Unhandled error");
  reply.status(500).send({
    error: error.message || "Internal server error",
  });
});

async function start() {
  try {
    ensureStudioRoot();
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info(`${STUDIO_NAME} initialized.`);
    logger.info("Local-first cinematic intelligence platform ready.");

    // Log dependency status on startup
    const { services } = await runHealthChecks();
    for (const s of services) {
      if (s.status === "ok") logger.info(`  ${s.name}: ok`);
      else if (s.status === "not_configured") logger.warn(`  ${s.name}: not configured`);
      else logger.error(`  ${s.name}: DOWN — ${s.message}`);
    }
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

start();
