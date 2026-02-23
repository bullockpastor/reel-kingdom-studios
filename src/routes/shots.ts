import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { queueRender } from "../services/render.service.js";
import { config } from "../config.js";

export async function shotRoutes(app: FastifyInstance) {
  // POST /shots/:id/render — Render an individual shot
  app.post("/:id/render", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      engine?: "local" | "premium";
      cinemaMode?: boolean;
      width?: number;
      height?: number;
      fps?: number;
      seed?: number;
    };

    const shot = await db.shot.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!shot) {
      return reply.status(404).send({ error: "Shot not found" });
    }

    if (shot.status === "rendering" || shot.status === "queued") {
      return reply.status(409).send({
        error: `Shot is already ${shot.status}`,
      });
    }

    // Determine engine: premium if explicitly requested, cinema mode, or QC failed twice
    let engine: "local" | "premium" = body.engine || "local";
    if (
      body.cinemaMode ||
      shot.qcFailCount >= config.QC_MAX_FAILURES_BEFORE_PREMIUM
    ) {
      engine = "premium";
    }

    if (engine === "premium" && !config.PREMIUM_PROVIDER) {
      return reply.status(400).send({
        error:
          "Premium rendering not configured. Set PREMIUM_PROVIDER in .env",
      });
    }

    try {
      const result = await queueRender(shot, {
        engine,
        width: body.width || config.WAN21_DEFAULT_WIDTH,
        height: body.height || config.WAN21_DEFAULT_HEIGHT,
        fps: body.fps || config.WAN21_DEFAULT_FPS,
        seed: body.seed,
      });
      return reply.status(202).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Render failed";
      return reply.status(500).send({ error: message });
    }
  });
}
