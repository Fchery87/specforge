import { describe, it, expect } from "vitest";
import fs from "fs";

describe("env docs", () => {
  it("documents CONVEX_ENCRYPTION_KEY", () => {
    const env = fs.readFileSync(".env.example", "utf8");
    expect(env).toContain("CONVEX_ENCRYPTION_KEY");
  });
});
