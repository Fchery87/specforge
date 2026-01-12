import { describe, it, expect } from "vitest";
import { redactSecrets } from "../logging";

describe("redactSecrets", () => {
  it("redacts common secret keys", () => {
    const input = { apiKey: "sk-test", token: "tok", other: "value" };
    expect(redactSecrets(input)).toEqual({
      apiKey: "[redacted]",
      token: "[redacted]",
      other: "value",
    });
  });

  it("redacts nested objects", () => {
    const input = {
      provider: "openai",
      credentials: { secret: "shh", modelId: "gpt-4o" },
    };
    expect(redactSecrets(input)).toEqual({
      provider: "openai",
      credentials: { secret: "[redacted]", modelId: "gpt-4o" },
    });
  });
});
