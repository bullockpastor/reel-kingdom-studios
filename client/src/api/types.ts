export interface Project {
  id: string;
  title: string;
  idea: string;
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
  status: "pending" | "queued" | "rendering" | "rendered" | "failed" | "premium_routed";
  renderPath: string | null;
  renderUrl: string | null;
  renderEngine: string | null;
  qcScore: number | null;
  qcFailCount: number;
  errorMessage: string | null;
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
