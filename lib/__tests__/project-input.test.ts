import { describe, it, expect } from "vitest";
import { normalizeProjectInput } from "../project-input";

describe("normalizeProjectInput", () => {
  it("rejects too-long titles", () => {
    expect(() =>
      normalizeProjectInput({ title: "x".repeat(101), description: "ok" })
    ).toThrow();
  });

  it("trims and validates description", () => {
    const result = normalizeProjectInput({
      title: " Test ",
      description: "desc",
    });
    expect(result.title).toBe("Test");
  });
});
