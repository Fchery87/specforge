import { describe, it, expect } from "vitest";
import fs from "fs";

describe("phase gating", () => {
  it("adds required question enforcement", () => {
    const content = fs.readFileSync("convex/actions/generatePhase.ts", "utf8");
    expect(content).toContain("hasMissingRequiredAnswers");
    expect(content).toContain("Please answer all required questions before generating");
  });
});
