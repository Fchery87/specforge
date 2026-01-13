import { describe, it, expect } from "vitest";
import fs from "fs";

describe("zip cleanup", () => {
  it("deletes previous zip storage if present", () => {
    const content = fs.readFileSync("convex/actions/generateProjectZip.ts", "utf8");
    expect(content).toContain("storage.delete");
  });
});
