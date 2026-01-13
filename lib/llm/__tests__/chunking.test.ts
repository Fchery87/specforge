import { describe, it, expect } from "vitest";
import { getSectionPlan } from "../chunking";

describe("getSectionPlan", () => {
  it("keeps prd sections within timeout budget", () => {
    const sections = getSectionPlan("prd", "prd");
    expect(sections.length).toBeLessThanOrEqual(3);
  });
});
