import { describe, it, expect } from "vitest";
import { getProviderIcon, getProviderDescription, POPULAR_PROVIDER_IDS } from "../metadata";
import { Globe, Brain, Sparkles } from "lucide-react";

describe("Provider Metadata", () => {
  it("returns specific icons for known providers", () => {
    expect(getProviderIcon("anthropic")).toBe(Brain);
    expect(getProviderIcon("openai")).toBe(Sparkles);
  });

  it("falls back to Globe icon for unknown providers", () => {
    expect(getProviderIcon("unknown-provider")).toBe(Globe);
  });

  it("returns specific descriptions for known providers", () => {
    expect(getProviderDescription("anthropic")).toContain("Claude");
    expect(getProviderDescription("openai")).toContain("GPT");
  });

  it("returns fallback description for unknown providers", () => {
    expect(getProviderDescription("custom-llm")).toBe("AI models via custom-llm");
  });

  it("defines popular provider IDs", () => {
    expect(POPULAR_PROVIDER_IDS).toContain("anthropic");
    expect(POPULAR_PROVIDER_IDS).toContain("openai");
    expect(POPULAR_PROVIDER_IDS).toContain("zai");
  });
});
