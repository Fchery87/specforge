import { describe, it, expect } from "vitest";
import { toPublicUserConfig } from "../user-config-public";

describe("toPublicUserConfig", () => {
  it("removes apiKey and exposes hasApiKey", () => {
    const result = toPublicUserConfig({ apiKey: "secret", provider: "openai" } as any);
    expect(result.apiKey).toBeUndefined();
    expect(result.hasApiKey).toBe(true);
  });

  it("marks hasApiKey false when missing", () => {
    const result = toPublicUserConfig({ provider: "openai" } as any);
    expect(result.hasApiKey).toBe(false);
  });
});
