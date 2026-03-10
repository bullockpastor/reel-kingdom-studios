import type { IPremiumVideoProvider } from "./premium.interface.js";
import type { PremiumProvider } from "./premium.types.js";
import { OpenAISoraProvider } from "./openai-sora.provider.js";
import { RunwayGen4Provider } from "./runway-gen4.provider.js";
import { KlingVideoProvider } from "./kling-video.provider.js";
import { GoogleVeoProvider } from "./google-veo.provider.js";
import { FalWan21Provider } from "./fal-wan21.provider.js";
import { config } from "../../../config.js";

const providerCache = new Map<string, IPremiumVideoProvider>();

export function getPremiumVideoProvider(providerKey?: string): IPremiumVideoProvider {
  const key = (providerKey ?? config.PREMIUM_VIDEO_PROVIDER) as PremiumProvider | undefined;

  if (!key) {
    throw new Error(
      "No premium video provider configured. " +
        "Set PREMIUM_VIDEO_PROVIDER in .env (openai_sora | runway_gen4 | kling_video | google_veo)."
    );
  }

  if (providerCache.has(key)) {
    return providerCache.get(key)!;
  }

  let provider: IPremiumVideoProvider;

  switch (key) {
    case "openai_sora": {
      if (!config.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required for the openai_sora provider.");
      }
      provider = new OpenAISoraProvider(config.OPENAI_API_KEY, config.OPENAI_VIDEO_MODEL);
      break;
    }
    case "runway_gen4": {
      if (!config.RUNWAY_API_KEY) {
        throw new Error("RUNWAY_API_KEY is required for the runway_gen4 provider.");
      }
      provider = new RunwayGen4Provider(config.RUNWAY_API_KEY, config.RUNWAY_VIDEO_MODEL);
      break;
    }
    case "kling_video": {
      if (!config.KLING_API_KEY) {
        throw new Error("KLING_API_KEY is required for the kling_video provider.");
      }
      provider = new KlingVideoProvider(config.KLING_API_KEY, config.KLING_VIDEO_MODEL);
      break;
    }
    case "google_veo": {
      if (!config.GOOGLE_VERTEX_PROJECT) {
        throw new Error("GOOGLE_VERTEX_PROJECT is required for the google_veo provider.");
      }
      if (!config.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error(
          "GOOGLE_APPLICATION_CREDENTIALS is required for the google_veo provider."
        );
      }
      provider = new GoogleVeoProvider(
        config.GOOGLE_VEO_MODEL,
        config.GOOGLE_VERTEX_PROJECT,
        config.GOOGLE_VERTEX_LOCATION,
        config.GOOGLE_APPLICATION_CREDENTIALS
      );
      break;
    }
    case "fal_wan21": {
      if (!config.FAL_API_KEY) {
        throw new Error("FAL_API_KEY is required for the fal_wan21 provider.");
      }
      provider = new FalWan21Provider(config.FAL_API_KEY);
      break;
    }
    default: {
      throw new Error(
        `Unknown premium provider: "${key}". ` +
          "Valid options: openai_sora | runway_gen4 | kling_video | google_veo | fal_wan21"
      );
    }
  }

  providerCache.set(key, provider);
  return provider;
}

/** Clear cached provider instances (useful in tests). */
export function clearProviderCache(): void {
  providerCache.clear();
}
