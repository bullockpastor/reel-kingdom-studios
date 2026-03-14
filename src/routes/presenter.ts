import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { extname } from "node:path";
import { db } from "../db.js";
import { config } from "../config.js";
import { ensureProjectDirs, ensurePresenterDirs } from "../storage/studio-root.js";
import { generatePresenterPipeline, queuePresenterRenders } from "../services/presenter.service.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function toAssetUrl(absolutePath: string | null): string | null {
  if (!absolutePath) return null;
  const prefix = config.STUDIO_ROOT.endsWith("/") ? config.STUDIO_ROOT : config.STUDIO_ROOT + "/";
  if (!absolutePath.startsWith(prefix)) return null;
  return "/assets/" + absolutePath.slice(prefix.length);
}

export async function presenterRoutes(app: FastifyInstance) {

  // ─── Presenter Profiles ───────────────────────────────────────────────────

  // GET /presenter/profiles — List all presenter profiles
  app.get("/profiles", async () => {
    const presenters = await db.presenter.findMany({
      orderBy: { createdAt: "desc" },
    });
    return presenters.map((p) => ({
      ...p,
      referenceImageUrl: toAssetUrl(p.referenceImagePath),
    }));
  });

  // POST /presenter/profiles — Create a presenter profile
  //
  // referenceImagePath (optional): absolute path to a local image used by the Runway
  // provider for identity anchoring. Expected convention:
  //   $STUDIO_ROOT/presenters/<presenter_slug>/reference/<image_file>
  // Example:
  //   /Volumes/T9/ReelKingdomStudios/presenters/pastor_bullock/reference/pastor-bullock.jpg
  app.post("/profiles", async (request, reply) => {
    const body = request.body as {
      name: string;
      description: string;
      referenceImagePath?: string;
      voiceId?: string;
      defaultProvider?: string;
      defaultTemplateId?: string;
    };

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: "name is required" });
    }
    if (!body.description?.trim()) {
      return reply.status(400).send({ error: "description is required" });
    }

    const presenter = await db.presenter.create({
      data: {
        name: body.name.trim(),
        description: body.description.trim(),
        referenceImagePath: body.referenceImagePath?.trim() || null,
        voiceId: body.voiceId ?? null,
        defaultProvider: body.defaultProvider ?? "runway_gen4",
        defaultTemplateId: body.defaultTemplateId ?? null,
      },
    });

    return reply.status(201).send({
      ...presenter,
      referenceImageUrl: toAssetUrl(presenter.referenceImagePath),
    });
  });

  // PATCH /presenter/profiles/:id — Update a presenter profile
  app.patch("/profiles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      referenceImagePath?: string | null;
      voiceId?: string | null;
      defaultProvider?: string;
      defaultTemplateId?: string | null;
    };

    const existing = await db.presenter.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Presenter not found" });
    }

    const updated = await db.presenter.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description.trim() }),
        ...(body.referenceImagePath !== undefined && { referenceImagePath: body.referenceImagePath || null }),
        ...(body.voiceId !== undefined && { voiceId: body.voiceId }),
        ...(body.defaultProvider !== undefined && { defaultProvider: body.defaultProvider }),
        ...(body.defaultTemplateId !== undefined && { defaultTemplateId: body.defaultTemplateId }),
      },
    });

    return reply.send({
      ...updated,
      referenceImageUrl: toAssetUrl(updated.referenceImagePath),
    });
  });

  // POST /presenter/profiles/:id/reference-image — Upload reference image
  app.post("/profiles/:id/reference-image", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.presenter.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Presenter not found" });
    }

    const part = await request.file();
    if (!part) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
      return reply.status(400).send({ error: "Only JPEG, PNG, and WebP images are allowed" });
    }

    const ext = extname(part.filename).toLowerCase() || ".jpg";
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return reply.status(400).send({ error: "Invalid file extension" });
    }

    const { referenceDir } = ensurePresenterDirs(id);
    const savePath = `${referenceDir}/reference${ext}`;

    await pipeline(part.file, createWriteStream(savePath));

    const updated = await db.presenter.update({
      where: { id },
      data: { referenceImagePath: savePath },
    });

    return reply.send({
      ...updated,
      referenceImageUrl: toAssetUrl(updated.referenceImagePath),
    });
  });

  // GET /presenter/profiles/:id — Get one presenter profile
  app.get("/profiles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const presenter = await db.presenter.findUnique({ where: { id } });
    if (!presenter) {
      return reply.status(404).send({ error: "Presenter not found" });
    }

    return {
      ...presenter,
      referenceImageUrl: toAssetUrl(presenter.referenceImagePath),
    };
  });

  // ─── Presenter Projects ───────────────────────────────────────────────────

  // POST /presenter/projects — Create project + run Script Director + Performance Director
  app.post("/projects", async (request, reply) => {
    const body = request.body as {
      rawScript: string;
      presenterId: string;
      title?: string;
      videoType?: string;
      targetDurationSeconds?: number;
      provider?: string;
    };

    if (!body.rawScript?.trim()) {
      return reply.status(400).send({ error: "rawScript is required" });
    }
    if (!body.presenterId?.trim()) {
      return reply.status(400).send({ error: "presenterId is required" });
    }

    const presenter = await db.presenter.findUnique({ where: { id: body.presenterId } });
    if (!presenter) {
      return reply.status(404).send({ error: "Presenter not found" });
    }

    // Create project
    const title = body.title?.trim() || `${presenter.name} — ${body.videoType ?? "Sermon"}`;
    const project = await db.project.create({
      data: {
        title,
        idea: body.rawScript.trim().slice(0, 500),
        projectType: "presenter",
        format: "horizontal",
        targetAspectRatio: "16:9",
        targetWidth: 832,
        targetHeight: 480,
      },
    });

    ensureProjectDirs(project.id);

    try {
      const { presenterScriptId, shots, agentResults } = await generatePresenterPipeline(
        project,
        body.rawScript.trim(),
        presenter,
        {
          videoType: body.videoType,
          targetDurationSeconds: body.targetDurationSeconds,
          selectedProvider: body.provider?.trim() || undefined,
        }
      );

      const presenterScript = await db.presenterScript.findUnique({
        where: { id: presenterScriptId },
        include: { presenter: true },
      });

      return reply.status(201).send({
        project: { ...project, projectType: "presenter" },
        presenterScript,
        shots: shots.map((s) => ({ ...s, renderUrl: null })),
        agentResults: agentResults.map((r) => ({
          agentName: r.agentName,
          durationMs: r.durationMs,
        })),
      });
    } catch (err) {
      // Mark project failed on pipeline error
      await db.project.update({ where: { id: project.id }, data: { status: "failed" } });
      const message = err instanceof Error ? err.message : "Presenter pipeline failed";
      return reply.status(500).send({ error: message });
    }
  });

  // GET /presenter/projects/:id — Get project + presenterScript + shots
  app.get("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.project.findUnique({
      where: { id },
      include: {
        shots: { orderBy: { shotIndex: "asc" } },
        presenterScript: { include: { presenter: true } },
      },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    return {
      ...project,
      outputUrl: toAssetUrl(project.outputPath),
      shots: project.shots.map((s) => ({
        ...s,
        renderUrl: toAssetUrl(s.renderPath),
      })),
    };
  });

  // POST /presenter/projects/:id/direct — Re-run direction (if script edited)
  app.post("/projects/:id/direct", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { rawScript?: string };

    const project = await db.project.findUnique({
      where: { id },
      include: { presenterScript: { include: { presenter: true } } },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    if (!project.presenterScript) {
      return reply.status(400).send({ error: "No presenter script found for this project" });
    }

    const rawScript = body.rawScript?.trim() || project.presenterScript.rawScript;
    const presenter = project.presenterScript.presenter;

    // Delete existing shots before re-directing
    await db.shot.deleteMany({ where: { projectId: id } });

    // Reset project status
    await db.project.update({ where: { id }, data: { status: "created" } });

    try {
      const { presenterScriptId, shots, agentResults } = await generatePresenterPipeline(
        project,
        rawScript,
        presenter,
        { videoType: project.presenterScript.deliveryMode }
      );

      const presenterScript = await db.presenterScript.findUnique({
        where: { id: presenterScriptId },
        include: { presenter: true },
      });

      return reply.send({
        presenterScript,
        shots: shots.map((s) => ({ ...s, renderUrl: null })),
        agentResults: agentResults.map((r) => ({
          agentName: r.agentName,
          durationMs: r.durationMs,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Re-direction failed";
      return reply.status(500).send({ error: message });
    }
  });

  // POST /presenter/projects/:id/produce — Queue all shots for rendering
  app.post("/projects/:id/produce", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { provider?: string };

    const project = await db.project.findUnique({
      where: { id },
      include: { presenterScript: { include: { presenter: true } } },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    if (!project.presenterScript) {
      return reply.status(400).send({ error: "No presenter script found. Run /direct first." });
    }

    try {
      const results = await queuePresenterRenders(
        project,
        project.presenterScript,
        body.provider
      );
      return reply.send({ message: `Queued ${results.length} presenter shots`, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Produce failed";
      return reply.status(500).send({ error: message });
    }
  });
}
