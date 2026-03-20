import { describe, test, expect } from "vitest";
import { formatForClaudeCode, formatForCursor, formatForCopilot } from "../export/clipboard-formats";

describe("clipboard-formats", () => {
  test("formatForClaudeCode includes title and content", () => {
    const result = formatForClaudeCode({ title: "My App", content: "# Rules\nBe good." });
    expect(result).toContain("My App");
    expect(result).toContain("Be good.");
    expect(result).toMatch(/^# My App — SpecForge/);
  });

  test("formatForClaudeCode includes SpecForge attribution", () => {
    const result = formatForClaudeCode({ title: "X", content: "Y" });
    expect(result).toContain("SpecForge");
  });

  test("formatForCursor includes title and content", () => {
    const result = formatForCursor({ title: "My App", content: "# Spec" });
    expect(result).toContain("My App");
    expect(result).toContain("# Spec");
  });

  test("formatForCursor output starts with # Project: title", () => {
    const result = formatForCursor({ title: "My App", content: "# Spec" });
    expect(result).toMatch(/^# Project: My App/);
  });

  test("formatForCopilot includes title and content", () => {
    const result = formatForCopilot({ title: "My App", content: "# Spec" });
    expect(result).toContain("My App");
    expect(result).toContain("# Spec");
  });

  test("formatForCopilot output starts with # title", () => {
    const result = formatForCopilot({ title: "My App", content: "# Spec" });
    expect(result).toMatch(/^# My App\n/);
  });

  test("formatForClaudeCode output starts with # title", () => {
    const result = formatForClaudeCode({ title: "TestProj", content: "content" });
    expect(result.startsWith("# TestProj")).toBe(true);
  });
});
