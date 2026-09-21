import { describe, it, expect } from "vitest";
import { getModelById, getProviderDisplayName } from "../registry";

describe("deepseek registry", () => {
  it("registers deepseek provider display name", () => {
    expect(getProviderDisplayName("deepseek")).toBe("DeepSeek");
  });

  it("includes deepseek-v4-flash model", () => {
    const model = getModelById("deepseek-v4-flash");
    expect(model?.provider).toBe("deepseek");
  });
});
