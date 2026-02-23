import type { FastifyInstance } from "fastify";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db.js";
import { config } from "../config.js";
import { ensureProjectDirs } from "../storage/studio-root.js";
import { generateStoryboard } from "../services/storyboard.service.js";
import { queueAssembly } from "../services/assembly.service.js";

const FORMAT_PRESETS: Record<string, { aspectRatio: string; width: number; height: number }> = {
  horizontal: { aspectRatio: "16:9", width: 832, height: 480 },
  vertical:   { aspectRatio: "9:16", width: 480, height: 832 },
  square:     { aspectRatio: "1:1",  width: 512, height: 512 },
};

export async function projectRoutes(app: FastifyInstance) {
  // POST /projects — Create a new project
  app.post("/", async (request, reply) => {
    const { idea, title, format } = request.body as {
      idea: string;
      title?: string;
      format?: "vertical" | "horizontal" | "square";
    };

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      return reply.status(400).send({ error: "idea is required" });
    }

    const projectFormat = format || "horizontal";
    const preset = FORMAT_PRESETS[projectFormat];
    if (!preset) {
      return reply.status(400).send({ error: `Invalid format. Must be: vertical, horizontal, or square` });
    }

    const projectTitle = title?.trim() || idea.trim().slice(0, 60);

    const project = await db.project.create({
      data: {
        title: projectTitle,
        idea: idea.trim(),
        format: projectFormat,
        targetAspectRatio: preset.aspectRatio,
        targetWidth: preset.width,
        targetHeight: preset.height,
      },
    });

    const { shotsDir, outputDir } = ensureProjectDirs(project.id);

    // Write spec.json under STUDIO_ROOT
    const specPath = join(config.STUDIO_ROOT, project.id, "spec.json");
    writeFileSync(specPath, JSON.stringify({
      projectId: project.id,
      title: project.title,
      format: projectFormat,
      targetAspectRatio: preset.aspectRatio,
      resolution: { width: preset.width, height: preset.height },
      createdAt: project.createdAt,
    }, null, 2));

    return reply.status(201).send(project);
  });

  // POST /projects/:id/storyboard — Generate storyboard
  app.post("/:id/storyboard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      shotCount?: { min: number; max: number };
      totalDuration?: { min: number; max: number };
    };

    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    if (project.status !== "created") {
      return reply.status(409).send({
        error: `Project already has status "${project.status}". Cannot regenerate storyboard.`,
      });
    }

    const shotCount = body.shotCount || { min: 4, max: 8 };
    const totalDuration = body.totalDuration || { min: 15, max: 60 };

    try {
      const result = await generateStoryboard(project, shotCount, totalDuration);
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Storyboard generation failed";
      return reply.status(500).send({ error: message });
    }
  });

  // POST /projects/:id/assemble — Assemble rendered shots into final video
  app.post("/:id/assemble", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      transitionDuration?: number;
      outputFormat?: "mp4" | "webm";
    };

    const project = await db.project.findUnique({
      where: { id },
      include: { shots: { orderBy: { shotIndex: "asc" } }, storyboard: true },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const unrendered = project.shots.filter((s) => s.status !== "rendered");
    if (unrendered.length > 0) {
      return reply.status(400).send({
        error: "Not all shots are rendered",
        unrenderedShots: unrendered.map((s) => ({
          shotIndex: s.shotIndex,
          status: s.status,
        })),
      });
    }

    try {
      const result = await queueAssembly(
        project,
        project.shots,
        project.storyboard,
        body.transitionDuration,
        body.outputFormat
      );
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assembly failed";
      return reply.status(500).send({ error: message });
    }
  });
}
