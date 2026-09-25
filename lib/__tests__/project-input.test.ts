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

  it("accepts descriptions up to 20000 characters", () => {
    const validDesc = "a".repeat(20000);
    const result = normalizeProjectInput({
      title: "Valid Project",
      description: validDesc,
    });
    expect(result.description.length).toBe(20000);
  });

  it("rejects descriptions exceeding 20000 characters", () => {
    const tooLongDesc = "a".repeat(20001);
    expect(() =>
      normalizeProjectInput({
        title: "Valid Project",
        description: tooLongDesc,
      })
    ).toThrow("Description must be <= 20000 characters");
  });
});
