import type { VideoRenderer } from "./video-renderer.interface.js";
import type { PremiumRenderer } from "./premium-renderer.interface.js";
import { ComfyUIRenderer } from "./comfyui.renderer.js";
import { PremiumRendererStub } from "./premium.renderer.js";

let localRenderer: VideoRenderer | undefined;
let premiumRenderer: PremiumRenderer | undefined;

export function getLocalRenderer(): VideoRenderer {
  if (!localRenderer) {
    localRenderer = new ComfyUIRenderer();
  }
  return localRenderer;
}

/** @deprecated Use getPremiumVideoProvider() from the premium/ module instead. */
export function getPremiumRenderer(): PremiumRenderer {
  if (!premiumRenderer) {
    premiumRenderer = new PremiumRendererStub();
  }
  return premiumRenderer;
}

export type { VideoRenderer, RenderRequest, RenderResult } from "./video-renderer.interface.js";
export type { PremiumRenderer, PremiumRenderRequest, PremiumRenderResult } from "./premium-renderer.interface.js";

// New provider-agnostic premium layer
export { getPremiumVideoProvider, clearProviderCache } from "./premium/index.js";
export type {
  IPremiumVideoProvider,
  PremiumProvider,
} from "./premium/index.js";
