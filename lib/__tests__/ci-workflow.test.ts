import { describe, it, expect } from "vitest";
import fs from "fs";

describe("ci", () => {
  it("adds a GitHub Actions workflow", () => {
    const exists = fs.existsSync(".github/workflows/ci.yml");
    expect(exists).toBe(true);
  });
});
