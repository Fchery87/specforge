import { describe, it, expect, vi } from "vitest";
import { getAnswerOrFallback } from "../generateAllQuestionAnswers";

describe("generateAllQuestionAnswers helpers", () => {
  it("returns fallback when generator throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getAnswerOrFallback(async () => {
      throw new Error("rate limit");
    });
    expect(result).toContain("temporarily unavailable");
    spy.mockRestore();
  });
});
