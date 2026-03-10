import { describe, it, expect, vi } from "vitest";
import { withRetry, fetchWithRetry } from "./retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable status and eventually succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("HTTP 429"), { status: 429 }))
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws on non-retryable status", async () => {
    const err = Object.assign(new Error("HTTP 400"), { status: 400 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toThrow("HTTP 400");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const err = Object.assign(new Error("HTTP 503"), { status: 503 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow("HTTP 503");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
