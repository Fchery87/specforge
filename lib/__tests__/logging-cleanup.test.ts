import { describe, it, expect } from "vitest";
import fs from "fs";

describe("questions panel logging", () => {
  it("removes debug console logs", () => {
    const content = fs.readFileSync("components/questions-panel.tsx", "utf8");
    expect(content).not.toContain("[DEBUG]");
  });
});
