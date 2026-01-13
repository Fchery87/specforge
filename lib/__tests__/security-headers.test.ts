import { describe, it, expect } from "vitest";
import fs from "fs";

describe("security headers", () => {
  it("adds a CSP header in next config", () => {
    const content = fs.readFileSync("next.config.js", "utf8");
    expect(content).toContain("Content-Security-Policy");
  });
});
