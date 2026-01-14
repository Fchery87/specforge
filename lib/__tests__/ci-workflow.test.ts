import { describe, it, expect } from "vitest";
import fs from "fs";

describe("ci", () => {
  it("adds a GitHub Actions workflow", () => {
    const exists = fs.existsSync(".github/workflows/ci.yml");
    expect(exists).toBe(true);
  });

  it("runs Convex codegen before typecheck", () => {
    const content = fs.readFileSync(".github/workflows/ci.yml", "utf8");
    expect(content).toContain("convex codegen");
  });
});
