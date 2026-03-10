/**
 * Retry with exponential backoff for transient failures (429, 5xx).
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 16000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(status);
}

/**
 * Execute an async operation with retry on transient HTTP errors.
 * Throws on non-retryable errors or when all retries are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const status = (err as { status?: number }).status ?? (err as { response?: { status?: number } }).response?.status;
      if (
        attempt < opts.maxRetries &&
        typeof status === "number" &&
        isRetryable(status, opts.retryableStatuses)
      ) {
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt),
          opts.maxDelayMs
        );
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/**
 * Wrapper for fetch that retries on 429 and 5xx.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const res = await fetch(url, init);
    if (isRetryable(res.status, (options && "retryableStatuses" in options) ? options.retryableStatuses! : DEFAULT_OPTIONS.retryableStatuses)) {
      const err = new Error(`HTTP ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    return res;
  }, options);
}
