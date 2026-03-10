import type { Project, Shot, HealthResponse, QueueStatus, Presenter, PresenterScript, Engine, ComparisonResult, RouteTableEntry, ResolvedRoute } from "./types";

const BASE = "";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Health
  health: () => request<HealthResponse>("/health"),

  // Projects
  listProjects: (status?: string) =>
    request<Project[]>(`/projects${status ? `?status=${status}` : ""}`),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (data: { idea: string; title?: string; format?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  generateStoryboard: (id: string, opts?: { shotCount?: { min: number; max: number }; totalDuration?: { min: number; max: number } }) =>
    request<{ storyboardId: string; shots: Shot[] }>(`/projects/${id}/storyboard`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
    }),
  renderAll: (id: string, engine?: "local" | "premium") =>
    request<{ message: string; results: unknown[] }>(`/projects/${id}/render-all`, {
      method: "POST",
      body: JSON.stringify(engine ? { engine } : {}),
    }),
  assemble: (
    id: string,
    opts?: {
      transitionDuration?: number;
      outputFormat?: "mp4" | "webm";
      backgroundMusicFile?: string;
    }
  ) =>
    request<{ message: string; jobId: string; outputPath: string }>(`/projects/${id}/assemble`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
    }),
  listAudioLibrary: () => request<{ files: string[] }>("/projects/audio-library"),
  reorderShots: (projectId: string, shotIds: string[]) =>
    request<{ shots: Shot[] }>(`/projects/${projectId}/shots/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ shotIds }),
    }),
  updateShot: (shotId: string, data: { trimStart?: number; trimEnd?: number }) =>
    request<Shot>(`/shots/${shotId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Shots
  getShot: (id: string) => request<Shot>(`/shots/${id}`),
  renderShot: (id: string, opts?: Record<string, unknown>) =>
    request<{ renderJob: unknown; bullmqJobId: string; message: string }>(`/shots/${id}/render`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
    }),

  // Queue
  queueStatus: () => request<QueueStatus>("/queue"),

  // Costs
  getCostSummary: () =>
    request<{
      monthlySpend: number;
      monthlyCap: number | null;
      byProvider: Record<string, number>;
      byProject: Array<{ projectId: string; spend: number }>;
    }>("/costs"),

  // Asset URL helper
  assetUrl: (relativePath: string) => `/assets/${relativePath}`,

  // Presenter profiles
  listPresenters: () => request<Presenter[]>("/presenter/profiles"),
  createPresenter: (data: {
    name: string;
    description: string;
    voiceId?: string;
    defaultProvider?: string;
    defaultTemplateId?: string;
  }) => request<Presenter>("/presenter/profiles", { method: "POST", body: JSON.stringify(data) }),
  getPresenter: (id: string) => request<Presenter>(`/presenter/profiles/${id}`),

  // Presenter projects
  createPresenterProject: (data: {
    rawScript: string;
    presenterId: string;
    title?: string;
    videoType?: string;
    targetDurationSeconds?: number;
    provider?: string;
  }) =>
    request<{ project: Project; presenterScript: PresenterScript; shots: Shot[]; agentResults: { agentName: string; durationMs: number }[] }>(
      "/presenter/projects",
      { method: "POST", body: JSON.stringify(data) }
    ),
  getPresenterProject: (id: string) => request<Project>(`/presenter/projects/${id}`),
  directPresenterProject: (id: string, data?: { rawScript?: string }) =>
    request<{ presenterScript: PresenterScript; shots: Shot[]; agentResults: unknown[] }>(
      `/presenter/projects/${id}/direct`,
      { method: "POST", body: JSON.stringify(data ?? {}) }
    ),
  producePresenterProject: (id: string, provider?: string) =>
    request<{ message: string; results: unknown[] }>(
      `/presenter/projects/${id}/produce`,
      { method: "POST", body: JSON.stringify({ provider }) }
    ),

  // Engines
  listEngines: () => request<Engine[]>("/engines"),
  setEngineDefault: (data: { mode: "presenter" | "premium_fallback"; provider: string }) =>
    request<{ ok: boolean; mode: string; provider: string }>("/engines/default", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  compareEngines: (data: { prompt: string; engines: string[]; durationSeconds?: number }) =>
    request<ComparisonResult>("/engines/compare", { method: "POST", body: JSON.stringify(data) }),
  getComparison: (id: string) => request<ComparisonResult>(`/engines/compare/${id}`),

  // Model Router
  listAgentRoutes: () => request<{ routes: RouteTableEntry[] }>("/model-router/routes"),
  setAgentRoute: (data: { agentName: string; provider: string; model?: string }) =>
    request<{ routes: RouteTableEntry[] }>("/model-router/routes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAgentRoute: (agentName: string) =>
    request<{ routes: RouteTableEntry[] }>(
      `/model-router/routes/${encodeURIComponent(agentName)}`,
      { method: "DELETE" }
    ),
  resolveRoute: (agentName: string) =>
    request<ResolvedRoute>(`/model-router/resolve/${encodeURIComponent(agentName)}`),
};
