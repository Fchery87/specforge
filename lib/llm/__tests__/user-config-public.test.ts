import { describe, it, expect } from "vitest";
import { toPublicUserConfig } from "../user-config-public";

describe("toPublicUserConfig", () => {
  it("removes apiKey and exposes hasApiKey", () => {
    const input = { apiKey: "secret", provider: "openai" } as any;
    const result = toPublicUserConfig(input);
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBeUndefined();
    expect(result!.hasApiKey).toBe(true);
  });

  it("marks hasApiKey false when missing", () => {
    const input = { provider: "openai" } as any;
    const result = toPublicUserConfig(input);
    expect(result).not.toBeNull();
    expect(result!.hasApiKey).toBe(false);
  });
});
