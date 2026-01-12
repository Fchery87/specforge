import { describe, it, expect } from "vitest";
import { getArtifactTypeForPhase } from "../artifact-types";

describe("getArtifactTypeForPhase", () => {
  it("maps stories to stories", () => {
    expect(getArtifactTypeForPhase("stories")).toBe("stories");
  });

  it("maps artifacts to artifacts", () => {
    expect(getArtifactTypeForPhase("artifacts")).toBe("artifacts");
  });

  it("maps specs to spec", () => {
    expect(getArtifactTypeForPhase("specs")).toBe("spec");
  });
});
