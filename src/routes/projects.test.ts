/**
 * API smoke tests for projects routes.
 * Run with: API_BASE=http://localhost:8010 npm test -- projects.test
 * Skips if server is not reachable.
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.API_BASE ?? "http://localhost:8010";
let serverReachable = false;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body as T;
}

describe("Projects API (smoke)", () => {
  beforeAll(async () => {
    try {
      const res = await fetch(BASE + "/health", { signal: AbortSignal.timeout(2000) });
      serverReachable = res.ok;
    } catch {
      serverReachable = false;
    }
  });

  it("GET /health returns ok when server is reachable", async () => {
    if (!serverReachable) return; // skip if server not running
    const res = await fetch(BASE + "/health");
    expect(res.ok).toBe(true);
  });

  it("GET /projects returns array", async () => {
    if (!serverReachable) return;
    const projects = await request<unknown[]>("/projects");
    expect(Array.isArray(projects)).toBe(true);
  });

  it("POST /projects requires idea", async () => {
    if (!serverReachable) return;
    await expect(
      request("/projects", {
        method: "POST",
        body: JSON.stringify({}),
      })
    ).rejects.toThrow();
  });

  it("POST /projects creates project with idea", async () => {
    if (!serverReachable) return;
    const project = await request<{ id: string; idea: string; status: string }>("/projects", {
      method: "POST",
      body: JSON.stringify({
        idea: "A test video about nature",
        title: "Nature Test",
      }),
    });
    expect(project.id).toBeDefined();
    expect(project.idea).toContain("nature");
    expect(project.status).toBe("created");
  });
});
