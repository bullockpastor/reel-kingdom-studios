import type { Project, Shot, HealthResponse, QueueStatus } from "./types";

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
  assemble: (id: string, opts?: { transitionDuration?: number; outputFormat?: "mp4" | "webm" }) =>
    request<{ message: string; jobId: string; outputPath: string }>(`/projects/${id}/assemble`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
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

  // Asset URL helper
  assetUrl: (relativePath: string) => `/assets/${relativePath}`,
};
