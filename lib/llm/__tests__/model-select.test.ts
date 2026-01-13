import { describe, it, expect } from "vitest";
import { selectEnabledModels } from "../model-select";

describe("selectEnabledModels", () => {
  it("filters enabled models", () => {
    const result = selectEnabledModels([
      { enabled: true, id: "a" },
      { enabled: false, id: "b" },
    ]);
    expect(result).toEqual([{ enabled: true, id: "a" }]);
  });
});
