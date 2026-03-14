import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { queueRender } from "../services/render.service.js";
import { config } from "../config.js";

export async function shotRoutes(app: FastifyInstance) {
  // GET /shots/:id — Single shot with render history
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const shot = await db.shot.findUnique({
      where: { id },
      include: {
        renderJobs: { orderBy: { createdAt: "desc" } },
        premiumAudits: { orderBy: { createdAt: "desc" } },
        project: true,
      },
    });

    if (!shot) {
      return reply.status(404).send({ error: "Shot not found" });
    }

    return shot;
  });

  // PATCH /shots/:id — Update shot fields (trimStart, trimEnd, lowerThirdEnabled)
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { trimStart?: number; trimEnd?: number; lowerThirdEnabled?: boolean };

    const shot = await db.shot.findUnique({ where: { id } });
    if (!shot) return reply.status(404).send({ error: "Shot not found" });

    const data: { trimStart?: number; trimEnd?: number; lowerThirdEnabled?: boolean } = {};
    if (typeof body.trimStart === "number" && body.trimStart >= 0) data.trimStart = body.trimStart;
    if (typeof body.trimEnd === "number" && body.trimEnd >= 0) data.trimEnd = body.trimEnd;
    if (typeof body.lowerThirdEnabled === "boolean") data.lowerThirdEnabled = body.lowerThirdEnabled;

    const updated = await db.shot.update({
      where: { id },
      data,
    });
    return updated;
  });

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
      /** Override which premium provider handles this shot (openai_sora | runway_gen4 | kling_video | google_veo). */
      provider?: string;
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

    if (engine === "premium" && !config.PREMIUM_VIDEO_PROVIDER && !body.provider) {
      return reply.status(400).send({
        error:
          "Premium rendering not configured. Set PREMIUM_VIDEO_PROVIDER in .env " +
          "or pass a provider in the request body.",
      });
    }

    try {
      const result = await queueRender(shot, {
        engine,
        width: body.width || config.WAN21_DEFAULT_WIDTH,
        height: body.height || config.WAN21_DEFAULT_HEIGHT,
        fps: body.fps || config.WAN21_DEFAULT_FPS,
        seed: body.seed,
        premiumProvider: body.provider,
      });
      return reply.status(202).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Render failed";
      return reply.status(500).send({ error: message });
    }
  });
}
