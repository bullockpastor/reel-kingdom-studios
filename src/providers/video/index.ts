import type { VideoRenderer } from "./video-renderer.interface.js";
import { ComfyUIRenderer } from "./comfyui.renderer.js";

let localRenderer: VideoRenderer | undefined;

export function getLocalRenderer(): VideoRenderer {
  if (!localRenderer) {
    localRenderer = new ComfyUIRenderer();
  }
  return localRenderer;
}

export type { VideoRenderer, RenderRequest, RenderResult } from "./video-renderer.interface.js";

// Provider-agnostic premium layer
export { getPremiumVideoProvider, clearProviderCache } from "./premium/index.js";
export type {
  IPremiumVideoProvider,
  PremiumProvider,
} from "./premium/index.js";
