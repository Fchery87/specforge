import { describe, expect, it } from "vitest";
import { readableError } from "../readable-error";

describe("readableError", () => {
  it("keeps only the sentence a Convex function threw", () => {
    const error = new Error(
      "[CONVEX M(changes:createChange)] [Request ID: 5f2e] Server Error\nUncaught Error: Generate the project's requirements before starting a change\n    at createChangeHandler (../convex/changes.ts:81:10)\n\n  Called by client"
    );

    expect(readableError(error)).toBe("Generate the project's requirements before starting a change");
  });

  it("passes a plain message through, and falls back when there is none", () => {
    expect(readableError(new Error("Network lost"))).toBe("Network lost");
    expect(readableError(undefined)).toBe("Something went wrong. Try again.");
  });
});
