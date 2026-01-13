import { describe, it, expect } from "vitest";
import fs from "fs";

const ADMIN_FILE = "convex/admin.ts";

describe("admin protections", () => {
  it("debugIdentity requires admin", () => {
    const content = fs.readFileSync(ADMIN_FILE, "utf8");
    const start = content.indexOf("export const debugIdentity");
    expect(start).toBeGreaterThan(-1);
    const nextExport = content.indexOf("export const", start + 1);
    const segment = content.slice(start, nextExport === -1 ? content.length : nextExport);
    expect(segment).toContain("requireAdmin");
  });
});
