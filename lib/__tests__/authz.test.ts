import { describe, it, expect } from "vitest";
import { canAccessProject } from "../authz";

describe("canAccessProject", () => {
  it("allows access when user owns project", () => {
    expect(canAccessProject("user-1", "user-1")).toBe(true);
  });

  it("denies access when user does not own project", () => {
    expect(canAccessProject("user-1", "user-2")).toBe(false);
  });
});
