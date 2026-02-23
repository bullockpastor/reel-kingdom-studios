import type {
  PremiumRenderer,
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumProviderParams,
} from "./premium-renderer.interface.js";
import { config } from "../../config.js";

export class PremiumRendererStub implements PremiumRenderer {
  readonly name = "Premium Renderer (Stub)";
  readonly provider: string;

  constructor() {
    this.provider = config.PREMIUM_PROVIDER || "none";
  }

  async render(
    _request: PremiumRenderRequest,
    _params?: PremiumProviderParams
  ): Promise<PremiumRenderResult> {
    if (!config.PREMIUM_PROVIDER) {
      return {
        success: false,
        requestId: "",
        estimatedCost: 0,
        provider: "none",
        responseMetadata: {},
        error:
          "Premium rendering not configured. Set PREMIUM_PROVIDER in .env to one of: runway, kling, pika",
      };
    }

    // Placeholder for future provider implementations
    return {
      success: false,
      requestId: "",
      estimatedCost: 0,
      provider: config.PREMIUM_PROVIDER,
      responseMetadata: {},
      error: `Provider "${config.PREMIUM_PROVIDER}" is not yet implemented.`,
    };
  }

  async checkStatus(_requestId: string): Promise<{ status: string; progress?: number }> {
    return { status: "not_implemented" };
  }

  async healthCheck(): Promise<boolean> {
    return !!config.PREMIUM_PROVIDER;
  }
}
