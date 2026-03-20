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

  it("uses user api key even when system credentials exist for different provider", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "deepseek",
        apiKey: "user-deepseek-key",
        defaultModel: "deepseek-chat",
        useSystem: false,
      },
      new Map([
        ["openai", { apiKey: "system-openai-key" }],
      ])
    );

    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("user-deepseek-key");
    expect(result?.modelId).toBe("deepseek-chat");
  });

  it("returns null when no credentials are available", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "openai",
        defaultModel: "gpt-4o",
        useSystem: false,
      },
      new Map()
    );

    expect(result).toBeNull();
  });

  it("uses system credential for user provider when user has no api key", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "deepseek",
        defaultModel: "deepseek-chat",
        useSystem: true,
      },
      new Map([
        ["deepseek", { apiKey: "system-deepseek-key" }],
        ["openai", { apiKey: "system-openai-key" }],
      ])
    );

    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("system-deepseek-key");
  });

  it("falls back to system credential when user provider has no system key", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "chutes",
        defaultModel: "some-model",
        useSystem: true,
      },
      new Map([
        ["deepseek", { apiKey: "system-deepseek-key" }],
      ])
    );

    // chutes has no system credential, should fall back to deepseek
    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("system-deepseek-key");
  });
});
