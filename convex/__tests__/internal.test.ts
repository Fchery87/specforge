import { describe, it, expect } from "vitest";
import { filterArtifactsByPhase } from "../internal";

describe("filterArtifactsByPhase", () => {
  it("returns artifacts matching project and phase", () => {
    const artifacts = [
      { projectId: "p1", phaseId: "brief", _id: "a1" },
      { projectId: "p1", phaseId: "specs", _id: "a2" },
      { projectId: "p2", phaseId: "brief", _id: "a3" },
    ];

    const result = filterArtifactsByPhase(artifacts as any, "p1", "brief");
    expect(result.map((a) => a._id ?? "")).toEqual(["a1"]);
  });
});
