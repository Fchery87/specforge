import { describe, it, expect } from "vitest";
import { buildTelemetry, shouldLogTelemetry } from "../telemetry";

describe("telemetry", () => {
  it("redacts secrets and excludes prompts", () => {
    const entry = buildTelemetry({
      provider: "openai",
      model: "gpt-4o",
      prompt: "secret",
      apiKey: "super-secret",
    });
    expect(entry).not.toHaveProperty("prompt");
    expect(entry).not.toHaveProperty("apiKey");
  });

  it("disables logging in test env", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    expect(shouldLogTelemetry()).toBe(false);
    process.env.NODE_ENV = previous;
  });
});
