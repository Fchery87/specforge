import { describe, it, expect } from "vitest";
import { expandSectionsForBudget } from "../chunking";

describe("expandSectionsForBudget", () => {
  it("expands a single section when budget is too small", () => {
    const expanded = expandSectionsForBudget({
      sectionNames: ["architecture-overview"],
      estimatedTokens: 12000,
      maxTokensPerSection: 4000,
    });

    expect(expanded.length).toBe(3);
    expect(expanded[0]).toBe("architecture-overview-part-1");
  });
});
