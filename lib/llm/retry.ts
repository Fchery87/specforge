export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const message = String(
    (error as { message?: string }).message ?? error
  ).toLowerCase();
  return (
    message.includes('too many api requests') ||
    message.includes('rate limit') ||
    message.includes('"code":"1305"') ||
    message.includes('429')
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    minDelayMs: number;
    maxDelayMs: number;
    deadline?: number; // absolute timestamp
  }
): Promise<T> {
  let attempt = 0;
  let delay = options.minDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;

      // Check deadline if provided
      if (options.deadline && Date.now() > options.deadline) {
        throw new Error('Retry deadline exceeded');
      }

      if (!isRateLimitError(error) || attempt > options.retries) {
        throw error;
      }

      const jitter = Math.floor(delay * 0.2 * Math.random());
      await sleep(delay + jitter);
      delay = Math.min(options.maxDelayMs, delay * 2);
    }
  }
}
