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

  it("includes deepseek-flash alias model", () => {
    const model = getModelById("deepseek-flash");
    expect(model?.provider).toBe("deepseek");
    expect(model?.contextTokens).toBe(1000000);
    expect(model?.maxOutputTokens).toBe(384000);
  });

  it("includes deepseek-chat model", () => {
    const model = getModelById("deepseek-chat");
    expect(model?.provider).toBe("deepseek");
    expect(model?.contextTokens).toBe(128000);
  });

  it("includes deepseek-reasoner model", () => {
    const model = getModelById("deepseek-reasoner");
    expect(model?.provider).toBe("deepseek");
    expect(model?.contextTokens).toBe(128000);
  });
});
