import { describe, it, expect, vi } from "vitest";
import { retryWithBackoff, isRateLimitError } from "../retry";

describe("retry helpers", () => {
  it("detects rate limit errors", () => {
    expect(isRateLimitError(new Error("Too many API requests"))).toBe(true);
    expect(isRateLimitError(new Error("Z.AI API error: {\"error\":{\"code\":\"1305\"}}"))).toBe(true);
    expect(isRateLimitError(new Error("Some other error"))).toBe(false);
  });

  it("retries on rate limit before succeeding", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Too many API requests"))
      .mockResolvedValueOnce("ok");

    const result = await retryWithBackoff(fn, { retries: 2, minDelayMs: 1, maxDelayMs: 2 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
