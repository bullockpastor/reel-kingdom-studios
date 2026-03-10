export interface Project {
  id: string;
  title: string;
  idea: string;
  projectType: string;
  format: "horizontal" | "vertical" | "square";
  targetAspectRatio: string;
  targetWidth: number;
  targetHeight: number;
  status: "created" | "storyboarded" | "rendering" | "assembling" | "assembled" | "failed";
  shotCount: number | null;
  outputPath: string | null;
  outputUrl: string | null;
  createdAt: string;
  updatedAt: string;
  shots?: Shot[];
  storyboard?: Storyboard | null;
  presenterScript?: PresenterScript | null;
  _count?: { shots: number };
}

export interface Shot {
  id: string;
  projectId: string;
  shotIndex: number;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  cameraMotion: string | null;
  mood: string | null;
  reframeFocus: string;
  reframePan: string;
  trimStart: number;
  trimEnd: number;
  status: "pending" | "queued" | "rendering" | "rendered" | "failed" | "premium_routed";
  renderPath: string | null;
  renderUrl: string | null;
  renderEngine: string | null;
  qcScore: number | null;
  qcFailCount: number;
  errorMessage: string | null;
  scriptSegmentJson: string | null;
  segmentIndex: number | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  renderJobs?: RenderJob[];
}

export interface Storyboard {
  id: string;
  projectId: string;
  rawJson: string;
  llmProvider: string;
  llmModel: string;
  retryCount: number;
  createdAt: string;
}

export interface RenderJob {
  id: string;
  shotId: string;
  bullmqJobId: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  engine: string;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  shot?: { shotIndex: number; projectId: string; prompt: string };
}

export interface Presenter {
  id: string;
  name: string;
  description: string;
  referenceImageUrl: string | null;
  voiceId: string | null;
  defaultProvider: string;
  defaultTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresenterScript {
  id: string;
  projectId: string;
  presenterId: string;
  rawScript: string;
  directedScript: string;
  performanceSpec: string;
  deliveryMode: string;
  templateId: string | null;
  selectedProvider: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  presenter?: Presenter;
}

export interface EngineTemplate {
  id: string;
  name: string;
  description: string;
}

export interface Engine {
  key: string;
  label: string;
  category: "local" | "premium" | "experimental";
  status: "configured" | "not_configured" | "local" | "unavailable";
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
  defaultRole: string[];
}

export interface StudioSettings {
  presenterDefaultProvider?: string;
  premiumFallbackProvider?: string;
}

export interface AgentRoute {
  provider: "ollama" | "claude" | "gemini";
  model?: string;
}

export interface RouteTableEntry {
  agentName: string;
  defaultRoute: AgentRoute;
  override: AgentRoute | null;
  effectiveRoute: AgentRoute;
  reason: "default" | "override" | "fallback";
  fallbackUsed: boolean;
  providerAvailable: boolean;
}

export interface ResolvedRoute extends AgentRoute {
  agentName: string;
  reason: "default" | "override" | "fallback";
  fallbackUsed: boolean;
}

export interface CompareShot {
  engine: string;
  shotId: string;
  shotIndex: number;
  status: string;
  renderUrl: string | null;
  errorMessage: string | null;
}

export interface ComparisonResult {
  comparisonId: string;
  status: string;
  shots: CompareShot[];
}

export interface HealthResponse {
  studio: string;
  tagline: string;
  healthy: boolean;
  services: ServiceStatus[];
  timestamp: string;
}

export interface ServiceStatus {
  name: string;
  status: "ok" | "down" | "not_configured";
  message?: string;
}

export interface QueueStatus {
  render: {
    counts: QueueCounts;
    recent: RenderJob[];
  };
  assembly: {
    counts: QueueCounts;
  };
}

export interface QueueCounts {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
}
