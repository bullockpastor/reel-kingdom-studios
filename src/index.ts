import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { ensureStudioRoot } from "./storage/studio-root.js";
import { runHealthChecks } from "./utils/health-check.js";
import { projectRoutes } from "./routes/projects.js";
import { shotRoutes } from "./routes/shots.js";

const app = Fastify({ logger: false });

app.register(cors);

// Health check — full dependency status
app.get("/health", async () => {
  const { healthy, services } = await runHealthChecks();
  return { healthy, services, timestamp: new Date().toISOString() };
});

// Routes
app.register(projectRoutes, { prefix: "/projects" });
app.register(shotRoutes, { prefix: "/shots" });

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
    logger.info(`Video Studio Platform running on http://0.0.0.0:${config.PORT}`);

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
