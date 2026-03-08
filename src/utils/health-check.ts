import { accessSync, constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { config } from "../config.js";

interface ServiceStatus {
  name: string;
  status: "ok" | "down" | "not_configured";
  message?: string;
}

async function checkOllama(): Promise<ServiceStatus> {
  try {
    const resp = await fetch(`${config.OLLAMA_URL}/api/tags`);
    if (resp.ok) return { name: "Ollama", status: "ok" };
    return { name: "Ollama", status: "down", message: `HTTP ${resp.status}` };
  } catch {
    return { name: "Ollama", status: "down", message: `Not reachable at ${config.OLLAMA_URL}` };
  }
}

async function checkComfyUI(): Promise<ServiceStatus> {
  try {
    const resp = await fetch(`${config.COMFYUI_URL}/queue`);
    if (resp.ok) return { name: "ComfyUI", status: "ok" };
    return { name: "ComfyUI", status: "down", message: `HTTP ${resp.status}` };
  } catch {
    return { name: "ComfyUI", status: "down", message: `Not reachable at ${config.COMFYUI_URL}` };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  try {
    const { getRedisConnection } = await import("../queue/connection.js");
    const redis = getRedisConnection();
    await redis.ping();
    return { name: "Redis", status: "ok" };
  } catch {
    return { name: "Redis", status: "down", message: `Not reachable at ${config.REDIS_URL}` };
  }
}

function checkStudioRoot(): ServiceStatus {
  try {
    accessSync(config.STUDIO_ROOT, constants.W_OK);
    return { name: "STUDIO_ROOT", status: "ok" };
  } catch {
    return { name: "STUDIO_ROOT", status: "down", message: `${config.STUDIO_ROOT} not writable` };
  }
}

function checkFFmpeg(): ServiceStatus {
  try {
    execFileSync(config.FFMPEG_PATH, ["-version"], { timeout: 5000 });
    return { name: "FFmpeg", status: "ok" };
  } catch {
    return { name: "FFmpeg", status: "down", message: `${config.FFMPEG_PATH} not found` };
  }
}

async function checkPremium(): Promise<ServiceStatus> {
  const provider = config.PREMIUM_VIDEO_PROVIDER;
  if (!provider) {
    return { name: "Premium Video", status: "not_configured" };
  }
  try {
    const { getPremiumVideoProvider } = await import("../providers/video/premium/index.js");
    const p = getPremiumVideoProvider(provider);
    const health = await p.checkHealth();
    return health.healthy
      ? { name: "Premium Video", status: "ok", message: provider }
      : { name: "Premium Video", status: "down", message: `${provider}: ${health.message}` };
  } catch (e) {
    return { name: "Premium Video", status: "down", message: String(e) };
  }
}

export async function runHealthChecks(): Promise<{
  healthy: boolean;
  services: ServiceStatus[];
}> {
  const services = await Promise.all([
    checkOllama(),
    checkComfyUI(),
    checkRedis(),
    Promise.resolve(checkStudioRoot()),
    Promise.resolve(checkFFmpeg()),
    checkPremium(),
  ]);

  const healthy = services
    .filter((s) => s.name !== "Premium Video") // Premium is optional
    .every((s) => s.status === "ok");

  return { healthy, services };
}

// Run standalone: npx tsx src/utils/health-check.ts
if (process.argv[1]?.endsWith("health-check.ts")) {
  runHealthChecks().then(({ healthy, services }) => {
    console.log("\n  Video Studio Platform — Health Check\n");
    for (const s of services) {
      const icon = s.status === "ok" ? "+" : s.status === "not_configured" ? "-" : "x";
      console.log(`  [${icon}] ${s.name}: ${s.status}${s.message ? ` (${s.message})` : ""}`);
    }
    console.log(`\n  Overall: ${healthy ? "HEALTHY" : "UNHEALTHY"}\n`);
    process.exit(healthy ? 0 : 1);
  });
}
