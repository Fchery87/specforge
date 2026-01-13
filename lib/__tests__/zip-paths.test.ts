import { describe, it, expect } from "vitest";
import { sanitizeZipPathSegment } from "../zip";

describe("sanitizeZipPathSegment", () => {
  it("removes path traversal", () => {
    expect(sanitizeZipPathSegment("../secret")).toBe("secret");
  });

  it("removes separators", () => {
    expect(sanitizeZipPathSegment("folder/name")).toBe("folder-name");
  });
});
