import { describe, it, expect } from "vitest";
import { resolveSystemKeyId } from "../user-config";

describe("resolveSystemKeyId", () => {
  it("returns undefined when not using system", () => {
    expect(resolveSystemKeyId({ useSystem: false, provider: "openai" })).toBeUndefined();
  });

  it("uses explicit systemKeyId when provided", () => {
    expect(
      resolveSystemKeyId({ useSystem: true, provider: "openai", systemKeyId: "openai" })
    ).toBe("openai");
  });

  it("falls back to provider when using system without id", () => {
    expect(resolveSystemKeyId({ useSystem: true, provider: "anthropic" })).toBe("anthropic");
  });
});
