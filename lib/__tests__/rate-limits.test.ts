import { describe, it, expect } from "vitest";
import fs from "fs";

describe("rate limits", () => {
  it("includes generateQuestions and generateProjectZip limits", () => {
    const content = fs.readFileSync("convex/rateLimiter.ts", "utf8");
    expect(content).toContain("generateQuestions");
    expect(content).toContain("generateProjectZip");
  });
});
