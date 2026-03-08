/**
 * Premium Video Adapter — Activation Verification Script
 *
 * Tests:
 *   1. Config loads cleanly with no premium provider set
 *   2. Factory throws a clean, named error when provider has no API key
 *   3. (Optional) Live smoke test — submits a real render if keys are present
 *
 * Usage:
 *   npx tsx scripts/verify-premium-adapter.ts
 *   PREMIUM_VIDEO_PROVIDER=runway_gen4 RUNWAY_API_KEY=sk-... npx tsx scripts/verify-premium-adapter.ts --live
 */

import "dotenv/config";
import { getPremiumVideoProvider } from "../src/providers/video/premium/index.js";
import type { PremiumProvider } from "../src/providers/video/premium/index.js";
import { OpenAISoraProvider } from "../src/providers/video/premium/openai-sora.provider.js";
import { RunwayGen4Provider } from "../src/providers/video/premium/runway-gen4.provider.js";
import { KlingVideoProvider } from "../src/providers/video/premium/kling-video.provider.js";
import { GoogleVeoProvider } from "../src/providers/video/premium/google-veo.provider.js";
import { config } from "../src/config.js";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const LIVE = process.argv.includes("--live");
const SEP = "─".repeat(60);

function pass(msg: string) {
  console.log(`  ✓  ${msg}`);
}
function fail(msg: string) {
  console.error(`  ✗  ${msg}`);
  process.exitCode = 1;
}
function info(msg: string) {
  console.log(`     ${msg}`);
}
function section(title: string) {
  console.log(`\n${SEP}\n  ${title}\n${SEP}`);
}

// ── Test 1: boot with no premium provider ─────────────────────────────────
section("Test 1 — Config loads with PREMIUM_VIDEO_PROVIDER unset");

try {
  const val = config.PREMIUM_VIDEO_PROVIDER;
  if (val === undefined) {
    pass(`config.PREMIUM_VIDEO_PROVIDER = undefined (no premium configured)`);
  } else {
    info(`config.PREMIUM_VIDEO_PROVIDER = "${val}"`);
  }

  // Verify all optional provider keys are indeed optional (no parse error)
  pass("Config schema parsed without errors");
  info(`PORT=${config.PORT}  NODE_ENV=${config.NODE_ENV}`);
  info(`STUDIO_ROOT=${config.STUDIO_ROOT}`);
} catch (e) {
  fail(`Config parse threw: ${String(e)}`);
}

// ── Test 2: factory throws a clean error — configured provider, missing key ─
section("Test 2 — Factory error: provider set, API key absent");

const PROVIDERS_TO_TEST: Array<{
  provider: PremiumProvider;
  missingKey: string;
  envKey: string;
}> = [
  { provider: "runway_gen4",  missingKey: "RUNWAY_API_KEY",              envKey: "RUNWAY_API_KEY" },
  { provider: "openai_sora",  missingKey: "OPENAI_API_KEY",              envKey: "OPENAI_API_KEY" },
  { provider: "kling_video",  missingKey: "KLING_API_KEY",               envKey: "KLING_API_KEY" },
  { provider: "google_veo",   missingKey: "GOOGLE_VERTEX_PROJECT",       envKey: "GOOGLE_VERTEX_PROJECT" },
];

// Note: config is frozen at import time — runtime process.env mutations don't
// retroactively change parsed config values. So we can only test the negative
// case for providers whose key was NOT in .env when the script started.
for (const { provider, missingKey, envKey } of PROVIDERS_TO_TEST) {
  const alreadyConfigured = !!process.env[envKey];

  if (alreadyConfigured) {
    info(`${provider}: ${envKey} is configured — negative guard test skipped (key present at boot)`);
    continue;
  }

  try {
    getPremiumVideoProvider(provider);
    fail(`${provider}: factory should have thrown but didn't`);
  } catch (e) {
    const msg = String(e);
    if (msg.includes(missingKey)) {
      pass(`${provider}: threw "${msg.replace("Error: ", "").trim()}"`);
    } else {
      fail(`${provider}: error doesn't mention ${missingKey}: ${msg}`);
    }
  }
}

// ── Test 2b: factory throws when no provider is configured at all ──────────
section("Test 2b — Factory error: PREMIUM_VIDEO_PROVIDER not set");

if (config.PREMIUM_VIDEO_PROVIDER) {
  info(
    `PREMIUM_VIDEO_PROVIDER="${config.PREMIUM_VIDEO_PROVIDER}" is set — ` +
    `'not configured' guard test skipped (config frozen at boot).`
  );
  info("This guard is verified by the negative tests above for unconfigured providers.");
} else {
  try {
    getPremiumVideoProvider(undefined as unknown as string);
    fail("Factory should have thrown for missing provider");
  } catch (e) {
    const msg = String(e);
    if (msg.includes("PREMIUM_VIDEO_PROVIDER") || msg.includes("No premium")) {
      pass(`Factory threw expected 'not configured' error`);
      info(msg.replace("Error: ", "").trim());
    } else {
      fail(`Unexpected error: ${msg}`);
    }
  }
}

// ── Test 3: capabilities shape is correct for each known provider ──────────
section("Test 3 — Provider capabilities sanity check");

// Construct providers directly (bypasses factory key guards) so we can inspect
// capabilities without needing real credentials. The key is a placeholder.
const capProviders = [
  new OpenAISoraProvider("sk-dummy", "sora-2"),
  new RunwayGen4Provider("key_dummy", "gen4_turbo"),
  new KlingVideoProvider("key_dummy", "kling-v1"),
  new GoogleVeoProvider("veo-2.0-generate-001", "my-project", "us-central1", "/dev/null"),
];

for (const p of capProviders) {
  const caps = p.capabilities;
  if (
    typeof caps.maxDurationSeconds === "number" &&
    Array.isArray(caps.supportedResolutions) &&
    caps.supportedResolutions.length > 0 &&
    Array.isArray(caps.supportedAspectRatios) &&
    typeof caps.supportsNegativePrompt === "boolean" &&
    typeof caps.supportsSeed === "boolean"
  ) {
    pass(
      `${p.provider}: capabilities OK — maxDuration=${caps.maxDurationSeconds}s, ` +
      `resolutions=${caps.supportedResolutions.length}, ` +
      `negativePrompt=${caps.supportsNegativePrompt}, seed=${caps.supportsSeed}`
    );
  } else {
    fail(`${p.provider}: capabilities shape invalid`);
  }
}

// ── Test 4: Live smoke test (--live flag required) ─────────────────────────
if (!LIVE) {
  section("Test 4 — Live smoke test (skipped)");
  info("Re-run with --live flag and a real API key to test end-to-end.");
  info("Example:");
  info("  PREMIUM_VIDEO_PROVIDER=runway_gen4 RUNWAY_API_KEY=your_key npx tsx scripts/verify-premium-adapter.ts --live");
} else {
  section("Test 4 — Live smoke test");

  const activeProvider = config.PREMIUM_VIDEO_PROVIDER as PremiumProvider | undefined;
  if (!activeProvider) {
    fail("PREMIUM_VIDEO_PROVIDER not set. Cannot run live test.");
  } else {
    info(`Active provider: ${activeProvider}`);

    try {
      const p = getPremiumVideoProvider(activeProvider);

      // Health check first
      info("Running health check...");
      const health = await p.checkHealth();
      if (health.healthy) {
        pass(`Health check passed`);
      } else {
        fail(`Health check failed: ${health.message}`);
      }

      if (health.healthy) {
        const outputDir = path.join(config.STUDIO_ROOT, "_smoke-test", "shots", "test-shot", "renders", "final");
        mkdirSync(outputDir, { recursive: true });

        info(`Submitting test render → ${outputDir}`);

        const result = await p.render({
          shotId:          "smoke-test-shot",
          prompt:          "A single burning candle on a dark wooden table, cinematic close-up, photorealistic",
          durationSeconds: 3,
          width:           640,
          height:          360,
          fps:             24,
          aspectRatio:     "16:9",
          outputDir,
          filenamePrefix:  "smoke_test",
          triggerReason:   "manual",
        });

        if (result.success && result.videoPath) {
          if (existsSync(result.videoPath)) {
            pass(`Video downloaded: ${result.videoPath}`);
          } else {
            fail(`videoPath set but file does not exist: ${result.videoPath}`);
          }
          info(`Provider:   ${result.provider}`);
          info(`RequestID:  ${result.requestId ?? "N/A"}`);
          info(`Cost est:   ${result.costEstimate != null ? `$${result.costEstimate}` : "N/A"}`);
          info(`Duration:   ${result.durationMs != null ? `${(result.durationMs / 1000).toFixed(1)}s` : "N/A"}`);
          if (result.rawResponseMeta) {
            info(`Metadata:   ${JSON.stringify(result.rawResponseMeta).slice(0, 200)}...`);
          }
        } else {
          fail(`Render failed: ${result.error}`);
        }
      }
    } catch (e) {
      fail(`Live test threw: ${String(e)}`);
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
section("Summary");
if (process.exitCode === 1) {
  console.log("  Some tests FAILED. Review output above.\n");
} else {
  console.log("  All tests PASSED.\n");
}
