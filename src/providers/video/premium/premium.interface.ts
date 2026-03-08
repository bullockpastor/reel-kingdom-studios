import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";

export interface IPremiumVideoProvider {
  readonly provider: string;
  readonly capabilities: PremiumRenderCapabilities;
  render(request: PremiumRenderRequest): Promise<PremiumRenderResult>;
  checkHealth(): Promise<{ healthy: boolean; message?: string }>;
}
