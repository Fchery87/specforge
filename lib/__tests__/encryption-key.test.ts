import { describe, it, expect } from "vitest";
import { getRequiredEncryptionKey } from "../encryption-key";

describe("getRequiredEncryptionKey", () => {
  it("throws when encryption key missing", () => {
    const original = process.env.CONVEX_ENCRYPTION_KEY;
    delete process.env.CONVEX_ENCRYPTION_KEY;

    expect(() => getRequiredEncryptionKey()).toThrow(/CONVEX_ENCRYPTION_KEY/);

    if (original !== undefined) {
      process.env.CONVEX_ENCRYPTION_KEY = original;
    }
  });
});
