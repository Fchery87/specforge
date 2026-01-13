import { describe, it, expect } from "vitest";
import { resolveCredentials } from "../registry";

describe("resolveCredentials", () => {
  it("prefers user api key when provided", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "openai",
        apiKey: "user-key",
        defaultModel: "gpt-4o",
        useSystem: false,
      },
      new Map([
        ["openai", { apiKey: "system-key" }],
      ])
    );

    expect(result?.apiKey).toBe("user-key");
  });

  it("uses system key when user has no api key", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "openai",
        defaultModel: "gpt-4o",
        useSystem: false,
      },
      new Map([
        ["openai", { apiKey: "system-key" }],
      ])
    );

    expect(result?.apiKey).toBe("system-key");
  });

  it("falls back to first system credential when provider missing", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "openai",
        defaultModel: "gpt-4o",
        useSystem: false,
      },
      new Map([
        ["deepseek", { apiKey: "system-key" }],
      ])
    );

    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("system-key");
  });
});
