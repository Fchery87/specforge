import { describe, it, expect } from "vitest";
import { buildTelemetry } from "../telemetry";

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
});
