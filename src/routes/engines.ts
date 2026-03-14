import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { db } from "../db.js";
import { readSettings, writeSettings } from "../settings.js";
import { queueRender } from "../services/render.service.js";
import { ensureProjectDirs } from "../storage/studio-root.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type EngineStatus = "configured" | "not_configured" | "local" | "unavailable";
type EngineCategory = "local" | "premium" | "experimental";

interface EngineTemplate {
  id: string;
  name: string;
  description: string;
}

interface EngineMeta {
  key: string;
  label: string;
  category: EngineCategory;
  description: string;
  bestFor: string[];
  strengths: string[];
  weaknesses: string[];
  supportsReferenceImage: boolean;
  supportsPresenterMode: boolean;
  supportsCinematicMode: boolean;
  supportedAspectRatios: string[];
  maxDurationSeconds: number;
  templates: EngineTemplate[];
}

// ─── Static engine catalog ────────────────────────────────────────────────────

const ENGINE_CATALOG: EngineMeta[] = [
  {
    key: "runway_gen4",
    label: "Runway Gen4",
    category: "premium",
    description: "Industry-standard presenter and social video engine with reference image support for identity anchoring.",
    bestFor: ["Presenter videos", "Social clips", "Identity-consistent content"],
    strengths: ["Reference image support", "Fast generation", "Stable presenter framing", "Multiple aspect ratios"],
    weaknesses: ["Short max duration (10s)", "Credit-based cost", "Less cinematic depth than Sora"],
    supportsReferenceImage: true,
    supportsPresenterMode: true,
    supportsCinematicMode: false,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    maxDurationSeconds: 10,
    templates: [
      { id: "pulpit_presenter",    name: "Pulpit Presenter",       description: "Distinguished pastor at wooden pulpit, direct camera address, warm dramatic lighting, professional depth of field" },
      { id: "devotional_desk",     name: "Devotional Desk",        description: "Intimate desk setting, open Bible, soft warm side light, personal delivery for morning devotionals" },
      { id: "social_reel_hook",    name: "Social Reel Hook",       description: "Bold vertical close-up, high contrast, punchy opening frame optimized for social media hooks" },
      { id: "testimony_head",      name: "Testimony Talking Head", description: "Centered framing, church interior background, emotional testimonial delivery with natural light" },
    ],
  },
  {
    key: "openai_sora",
    label: "OpenAI Sora",
    category: "premium",
    description: "Premium cinematic engine for high-quality promos, long-form scenes, and rich visual storytelling.",
    bestFor: ["Cinematic promos", "Long-form scenes", "Visual storytelling", "Church openers"],
    strengths: ["Superior cinematic quality", "Longer clip durations", "Rich scene understanding", "Film-grade results"],
    weaknesses: ["Higher cost per clip", "No reference image support", "Slower generation"],
    supportsReferenceImage: false,
    supportsPresenterMode: false,
    supportsCinematicMode: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    maxDurationSeconds: 20,
    templates: [
      { id: "premium_sermon_promo",   name: "Premium Sermon Promo",    description: "Cinematic wide establishing shot transitioning to intimate delivery, film-grade color grading" },
      { id: "cinematic_church_opener",name: "Cinematic Church Opener", description: "Epic architecture reveal, dramatic movement, orchestral scene pacing" },
      { id: "hero_ministry_story",    name: "Hero Ministry Story",     description: "Documentary-style visual narrative, golden hour lighting, emotional arc across sequence" },
      { id: "social_cinematic_hook",  name: "Social Cinematic Hook",   description: "Cinematic quality in vertical format, premium visual storytelling for social audiences" },
    ],
  },
  {
    key: "google_veo",
    label: "Google Veo",
    category: "premium",
    description: "Google's video generation engine via Vertex AI — suited for polished promos and long explainer scenes.",
    bestFor: ["Long-form promos", "Explainer content", "Ministry website heroes"],
    strengths: ["High-quality motion", "Longer clips", "Good scene coherence"],
    weaknesses: ["Requires GCP/Vertex AI setup", "More complex configuration", "Limited aspect ratio support"],
    supportsReferenceImage: false,
    supportsPresenterMode: true,
    supportsCinematicMode: true,
    supportedAspectRatios: ["16:9"],
    maxDurationSeconds: 30,
    templates: [
      { id: "long_form_promo",       name: "Long-Form Promo",       description: "Extended scene with rich motion, ideal for ministry website hero videos or sermon series promos" },
      { id: "polished_presenter_alt",name: "Polished Presenter Alt", description: "Clean presenter delivery with polished production feel, alternative to Runway for presenter work" },
      { id: "cinematic_explainer",   name: "Cinematic Explainer",   description: "Visual explainer with cinematic depth for ministry announcements or program introductions" },
    ],
  },
  {
    key: "kling_video",
    label: "Kling Video",
    category: "experimental",
    description: "Experimental video engine with a distinctive visual style — useful for A/B testing alternate aesthetics.",
    bestFor: ["Experimental social visuals", "Alternate style testing", "A/B comparisons"],
    strengths: ["Unique visual style", "Competitive pricing", "Vertical format support"],
    weaknesses: ["Less predictable output", "Smaller community support", "Limited model documentation"],
    supportsReferenceImage: false,
    supportsPresenterMode: true,
    supportsCinematicMode: true,
    supportedAspectRatios: ["16:9", "9:16"],
    maxDurationSeconds: 10,
    templates: [
      { id: "experimental_social", name: "Experimental Social Visual",  description: "Stylized social clip with Kling's distinctive motion quality — ideal for testing alternate aesthetics" },
      { id: "alt_talking_head",    name: "Alternate Talking Head",      description: "Alternate presenter style with unique motion characteristics for A/B testing visual approaches" },
    ],
  },
  {
    key: "fal_wan21",
    label: "fal.ai Wan2.1",
    category: "premium",
    description: "Managed Wan2.1 text-to-video inference on fal.ai cloud GPUs — same model as local ComfyUI but renders in 2-4 minutes with no hardware required.",
    bestFor: ["Cinematic shots", "B-roll", "Fast Wan2.1 renders without local GPU"],
    strengths: ["Same Wan2.1 quality as local", "No GPU required", "2-4 min renders", "Negative prompt support", "Pay per generation"],
    weaknesses: ["No reference image support", "Per-generation cost", "Max 10s clips"],
    supportsReferenceImage: false,
    supportsPresenterMode: false,
    supportsCinematicMode: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    maxDurationSeconds: 10,
    templates: [
      { id: "cinematic_fal", name: "Cinematic Scene", description: "Full-quality Wan2.1 cinematic render on fal.ai cloud GPU — fast, no local hardware needed" },
    ],
  },
  {
    key: "runpod_wan",
    label: "RunPod WAN (Cloud GPU)",
    category: "local",
    description: "ComfyUI running on a RunPod RTX 4090 — same Wan2.1 workflow as local, but on cloud hardware. Start/stop from the Engines dashboard.",
    bestFor: ["Fast local-quality renders", "Offline Mac renders", "Cloud GPU on demand"],
    strengths: ["RTX 4090 speed (~2 min)", "Same Wan2.1 quality as local", "Start/stop to control costs", "No per-generation API cost"],
    weaknesses: ["Requires RunPod account", "~$0.74/hr when running", "Pod startup takes ~2-3 min", "Models re-download without network volume"],
    supportsReferenceImage: false,
    supportsPresenterMode: false,
    supportsCinematicMode: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    maxDurationSeconds: 10,
    templates: [
      { id: "runpod_cinematic", name: "Cloud Cinematic Scene", description: "Full-quality Wan2.1 render on RunPod RTX 4090 — same workflow as local ComfyUI, GPU-accelerated" },
    ],
  },
  {
    key: "local_wan",
    label: "Local WAN (ComfyUI)",
    category: "local",
    description: "Local draft rendering via ComfyUI — free, private, and runs on your hardware. Best for storyboard previews before committing to premium.",
    bestFor: ["Draft previews", "Storyboard review", "B-roll concepts", "Free iteration"],
    strengths: ["No API cost", "Fully local and private", "Fast iteration on drafts", "No rate limits"],
    weaknesses: ["Requires local GPU", "Lower output quality", "Slower without GPU acceleration"],
    supportsReferenceImage: false,
    supportsPresenterMode: false,
    supportsCinematicMode: true,
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    maxDurationSeconds: 10,
    templates: [
      { id: "draft_cinematic",    name: "Draft Cinematic Scene",  description: "Fast local draft of a cinematic shot for storyboard review — free, private, no API cost" },
      { id: "storyboard_preview", name: "Storyboard Preview",     description: "Low-cost visual approximation of planned shots before committing to premium render" },
      { id: "broll_concept",      name: "B-Roll Concept Render",  description: "Local b-roll concept render for scene planning, texture testing, or motion concept validation" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEngineStatus(key: string): EngineStatus {
  switch (key) {
    case "runway_gen4":  return config.RUNWAY_API_KEY                                                     ? "configured" : "not_configured";
    case "openai_sora":  return config.OPENAI_API_KEY                                                     ? "configured" : "not_configured";
    case "google_veo":   return (config.GOOGLE_VERTEX_PROJECT && config.GOOGLE_APPLICATION_CREDENTIALS)  ? "configured" : "not_configured";
    case "kling_video":  return config.KLING_API_KEY                                                      ? "configured" : "not_configured";
    case "fal_wan21":    return config.FAL_API_KEY                                                        ? "configured" : "not_configured";
    case "runpod_wan":   return config.RUNPOD_API_KEY                                                     ? "configured" : "not_configured";
    case "local_wan":    return "local";
    default:             return "unavailable";
  }
}

function getDefaultRole(key: string): string[] {
  const settings = readSettings();
  const presenterDefault = settings.presenterDefaultProvider ?? config.PREMIUM_VIDEO_PROVIDER ?? "runway_gen4";
  const fallbackDefault  = settings.premiumFallbackProvider;

  const roles: string[] = [];
  if (presenterDefault === key) roles.push("presenter_default");
  if (fallbackDefault  === key) roles.push("premium_fallback");
  return roles;
}

function toAssetUrl(absolutePath: string | null): string | null {
  if (!absolutePath) return null;
  const prefix = config.STUDIO_ROOT.endsWith("/") ? config.STUDIO_ROOT : config.STUDIO_ROOT + "/";
  if (!absolutePath.startsWith(prefix)) return null;
  return "/assets/" + absolutePath.slice(prefix.length);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function engineRoutes(app: FastifyInstance) {

  // GET /engines — full engine registry with live status
  app.get("/", async () => {
    return ENGINE_CATALOG.map((e) => ({
      ...e,
      status:      getEngineStatus(e.key),
      defaultRole: getDefaultRole(e.key),
    }));
  });

  // POST /engines/default — persist a default provider for a mode
  app.post("/default", async (request, reply) => {
    const { mode, provider } = request.body as {
      mode: "presenter" | "premium_fallback";
      provider: string;
    };

    const validProviders = ENGINE_CATALOG.map((e) => e.key);
    if (!validProviders.includes(provider)) {
      return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    }

    let updated: ReturnType<typeof readSettings>;
    if (mode === "presenter") {
      updated = writeSettings({ presenterDefaultProvider: provider });
    } else if (mode === "premium_fallback") {
      updated = writeSettings({ premiumFallbackProvider: provider });
    } else {
      return reply.status(400).send({ error: `Unknown mode: ${mode}` });
    }

    return { ok: true, mode, provider, settings: updated };
  });

  // POST /engines/compare — queue the same prompt through multiple engines side-by-side
  app.post("/compare", async (request, reply) => {
    const body = request.body as {
      prompt: string;
      engines: string[];
      durationSeconds?: number;
    };

    if (!body.prompt?.trim()) {
      return reply.status(400).send({ error: "prompt is required" });
    }
    if (!Array.isArray(body.engines) || body.engines.length === 0) {
      return reply.status(400).send({ error: "at least one engine is required" });
    }

    const duration = Math.min(Math.max(body.durationSeconds ?? 5, 5), 10);

    // Create a lightweight comparison project
    const project = await db.project.create({
      data: {
        title: `Engine Compare — ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        idea: body.prompt.trim().slice(0, 200),
        projectType: "comparison",
        format: "horizontal",
        targetAspectRatio: "16:9",
        targetWidth: 832,
        targetHeight: 480,
        status: "rendering",
        shotCount: body.engines.length,
      },
    });

    ensureProjectDirs(project.id);

    const shotResults = [];

    for (let i = 0; i < body.engines.length; i++) {
      const engineKey = body.engines[i];

      // Create shot — store intended engine in templateId for retrieval
      const shot = await db.shot.create({
        data: {
          projectId:      project.id,
          shotIndex:      i,
          prompt:         body.prompt.trim(),
          negativePrompt: "blurry, low quality, watermark, text overlay, deformed, artifacts",
          durationSeconds: duration,
          templateId:     engineKey,   // "engine label" for compare result lookup
          reframeFocus:   "center",
          reframePan:     "none",
        },
      });

      const isLocal = engineKey === "local_wan";

      const result = await queueRender(
        { ...shot, project },
        isLocal
          ? { engine: "local", width: project.targetWidth, height: project.targetHeight, fps: config.WAN21_DEFAULT_FPS }
          : { engine: "premium", premiumProvider: engineKey, width: project.targetWidth, height: project.targetHeight, fps: config.WAN21_DEFAULT_FPS }
      );

      shotResults.push({ engine: engineKey, shotId: shot.id, bullmqJobId: result.bullmqJobId });
    }

    return reply.status(201).send({
      comparisonId: project.id,
      shots: shotResults,
    });
  });

  // GET /engines/compare/:id — poll comparison result
  app.get("/compare/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.project.findUnique({
      where: { id },
      include: { shots: { orderBy: { shotIndex: "asc" } } },
    });

    if (!project || project.projectType !== "comparison") {
      return reply.status(404).send({ error: "Comparison not found" });
    }

    return {
      comparisonId: project.id,
      status: project.status,
      shots: project.shots.map((s) => ({
        engine:       s.templateId ?? "unknown",   // templateId stores the intended engine
        shotId:       s.id,
        shotIndex:    s.shotIndex,
        status:       s.status,
        renderUrl:    toAssetUrl(s.renderPath),
        errorMessage: s.errorMessage,
      })),
    };
  });
}
