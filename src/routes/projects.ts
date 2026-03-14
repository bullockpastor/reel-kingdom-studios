import type { FastifyInstance } from "fastify";
import { writeFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { db } from "../db.js";
import { config } from "../config.js";
import { ensureProjectDirs } from "../storage/studio-root.js";
import { generateStoryboard } from "../services/storyboard.service.js";
import { queueAssembly } from "../services/assembly.service.js";
import { queueRender, planRenders } from "../services/render.service.js";
import { preparePresenterTTS } from "../services/tts.service.js";
import { projectOutputDir } from "../storage/studio-root.js";

const FORMAT_PRESETS: Record<string, { aspectRatio: string; width: number; height: number }> = {
  horizontal: { aspectRatio: "16:9", width: 832, height: 480 },
  vertical:   { aspectRatio: "9:16", width: 480, height: 832 },
  square:     { aspectRatio: "1:1",  width: 512, height: 512 },
};

function toAssetUrl(absolutePath: string | null): string | null {
  if (!absolutePath) return null;
  const prefix = config.STUDIO_ROOT.endsWith("/") ? config.STUDIO_ROOT : config.STUDIO_ROOT + "/";
  if (!absolutePath.startsWith(prefix)) return null;
  return "/assets/" + absolutePath.slice(prefix.length);
}

export async function projectRoutes(app: FastifyInstance) {
  // GET /projects — List all projects
  app.get("/", async (request) => {
    const { status, sort, order } = request.query as {
      status?: string;
      sort?: string;
      order?: "asc" | "desc";
    };

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const projects = await db.project.findMany({
      where,
      orderBy: { [sort || "createdAt"]: order || "desc" },
      include: { _count: { select: { shots: true } } },
    });

    return projects.map((p) => ({
      ...p,
      outputUrl: toAssetUrl(p.outputPath),
    }));
  });

  // GET /projects/audio-library — List audio files in AUDIO_LIBRARY_PATH (recursive: music/, sfx/, etc.)
  app.get("/audio-library", async () => {
    if (!config.AUDIO_LIBRARY_PATH) return { files: [] };
    const exts = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".aiff", ".aif"];
    function walk(dir: string, base = ""): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const e of entries) {
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) {
          out.push(...walk(join(dir, e.name), rel));
        } else if (exts.includes(extname(e.name).toLowerCase())) {
          out.push(rel);
        }
      }
      return out;
    }
    try {
      const files = walk(config.AUDIO_LIBRARY_PATH).sort();
      return { files };
    } catch {
      return { files: [] };
    }
  });

  // GET /projects/:id — Single project with shots and storyboard
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.project.findUnique({
      where: { id },
      include: {
        shots: {
          orderBy: { shotIndex: "asc" },
          include: { renderJobs: { orderBy: { createdAt: "desc" }, take: 3 } },
        },
        storyboard: true,
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
      primaryAudioPath?: string;
      backgroundMusicPath?: string;
      backgroundMusicFile?: string; // filename in AUDIO_LIBRARY_PATH
    };

    const project = await db.project.findUnique({
      where: { id },
      include: {
        shots: { orderBy: { shotIndex: "asc" } },
        storyboard: true,
        presenterScript: { include: { presenter: true } },
      },
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

    let primaryAudioPath = body.primaryAudioPath;
    let backgroundMusicPath = body.backgroundMusicPath;

    // Auto-generate TTS for presenter projects when presenter has voiceId
    if (
      !primaryAudioPath &&
      project.projectType === "presenter" &&
      project.presenterScript?.presenter?.voiceId
    ) {
      const outputDir = projectOutputDir(project.id);
      const ttsPath = join(outputDir, "tts_narration.mp3");
      primaryAudioPath =
        (await preparePresenterTTS(
          project.id,
          project.presenterScript.directedScript,
          project.presenterScript.presenter.voiceId,
          ttsPath
        )) ?? undefined;
    }

    // Resolve background music from library if filename provided
    if (!backgroundMusicPath && body.backgroundMusicFile && config.AUDIO_LIBRARY_PATH) {
      backgroundMusicPath = join(config.AUDIO_LIBRARY_PATH, body.backgroundMusicFile);
    }

    const audioPaths =
      primaryAudioPath || backgroundMusicPath
        ? { primaryAudioPath, backgroundMusicPath }
        : undefined;

    try {
      const result = await queueAssembly(
        project,
        project.shots,
        project.storyboard,
        body.transitionDuration,
        body.outputFormat,
        audioPaths,
        project.presenterScript ?? null
      );
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assembly failed";
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /projects/:id/shots/reorder — Reorder shots by shotIndex
  app.patch("/:id/shots/reorder", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { shotIds: string[] };

    if (!Array.isArray(body.shotIds) || body.shotIds.length === 0) {
      return reply.status(400).send({ error: "shotIds array is required" });
    }

    const project = await db.project.findUnique({
      where: { id },
      include: { shots: { orderBy: { shotIndex: "asc" } } },
    });

    if (!project) return reply.status(404).send({ error: "Project not found" });

    const shotIds = new Set(project.shots.map((s) => s.id));
    const valid = body.shotIds.every((sid) => shotIds.has(sid));
    if (!valid || body.shotIds.length !== shotIds.size) {
      return reply.status(400).send({
        error: "shotIds must include exactly all shot IDs for this project",
      });
    }

    // Two-phase update: move to a large temporary offset first to avoid
    // the unique(projectId, shotIndex) constraint firing mid-transaction
    // when shots swap positions.
    const offset = 10000;
    await db.$transaction([
      ...body.shotIds.map((shotId, index) =>
        db.shot.update({ where: { id: shotId }, data: { shotIndex: offset + index } })
      ),
      ...body.shotIds.map((shotId, index) =>
        db.shot.update({ where: { id: shotId }, data: { shotIndex: index } })
      ),
    ]);

    const updated = await db.shot.findMany({
      where: { projectId: id },
      orderBy: { shotIndex: "asc" },
    });
    return { shots: updated };
  });

  // POST /projects/:id/render-all — Queue renders for all pending/failed shots
  app.post("/:id/render-all", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { engine?: "local" | "premium" };

    const project = await db.project.findUnique({
      where: { id },
      include: { shots: { orderBy: { shotIndex: "asc" } } },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const renderableShots = project.shots.filter(
      (s) => s.status === "pending" || s.status === "failed"
    );

    if (renderableShots.length === 0) {
      return reply.status(400).send({ error: "No shots to render" });
    }

    // Use Render Orchestrator plan for per-shot engine/resolution, or fall back to defaults
    let planByShotIndex: Map<number, { engine: string; width: number; height: number; fps: number; steps?: number; priority?: string }> = new Map();
    const forceEngine = body.engine;
    type PlanEntry = { shotIndex: number; engine: string; width: number; height: number; fps: number; steps?: number; priority?: string };
    let renderPlan: PlanEntry[] = [];

    try {
      const planResult = await planRenders(id);
      renderPlan = (planResult.renderPlan ?? []) as PlanEntry[];
      if (renderPlan.length > 0) {
        for (const p of renderPlan) {
          planByShotIndex.set(p.shotIndex, {
            engine: forceEngine ?? (p.engine === "premium" ? "premium" : "local"),
            width: p.width,
            height: p.height,
            fps: p.fps,
            steps: p.steps,
            priority: p.priority,
          });
        }
      }
    } catch {
      // Fall back to project defaults if plan fails (LLM unreachable, etc.)
    }

    const priorityOrder = ["high", "normal", "low"];
    const renderableWithPlan = renderableShots
      .map((shot) => {
        const plan = planByShotIndex.get(shot.shotIndex);
        const priority = plan?.priority ?? "normal";
        return { shot, plan, sortKey: priorityOrder.indexOf(priority) };
      })
      .sort((a, b) => a.sortKey - b.sortKey);

    const results = [];
    for (const { shot, plan } of renderableWithPlan) {
      let engine = plan?.engine ?? forceEngine ?? "local";
      if (engine === "premium" && !config.PREMIUM_VIDEO_PROVIDER) {
        engine = "local"; // Fall back to local if premium not configured
      }
      const width = plan?.width ?? project.targetWidth;
      const height = plan?.height ?? project.targetHeight;
      const fps = plan?.fps ?? config.WAN21_DEFAULT_FPS;
      const steps = plan?.steps;

      const result = await queueRender({ ...shot, project }, {
        engine: engine as "local" | "premium",
        width,
        height,
        fps,
        steps,
      });
      results.push(result);
    }

    await db.project.update({
      where: { id },
      data: { status: "rendering" },
    });

    return { message: `Queued ${results.length} renders`, results };
  });
}
