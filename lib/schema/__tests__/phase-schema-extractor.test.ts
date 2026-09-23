import { describe, it, expect } from "vitest";
import {
  extractCodeBlockSchemas,
  replaceCodeBlockInMarkdown,
  parseMarkdownSections,
  generatePhaseJsonExport,
  validateSchemaContent,
  convertJsonToYaml,
} from "../phase-schema-extractor";

describe("phase-schema-extractor", () => {
  const sampleMarkdown = `# Core Architecture Spec

This document details technical boundaries.

\`\`\`json
{
  "service": "specforge-api",
  "version": "1.0.0"
}
\`\`\`

## API Endpoints

GET /api/artifacts
POST /api/artifacts

Explicit test seam available via IArtifactService interface.

\`\`\`typescript
export interface ArtifactService {
  getById(id: string): Promise<Artifact>;
}
\`\`\`
`;

  it("extracts embedded code blocks with line numbers and languages", () => {
    const blocks = extractCodeBlockSchemas(sampleMarkdown);
    expect(blocks.length).toBe(2);
    expect(blocks[0].language).toBe("json");
    expect(blocks[0].content).toContain('"service": "specforge-api"');
    expect(blocks[1].language).toBe("typescript");
  });

  it("replaces a code block inside markdown without corrupting surrounding text", () => {
    const blocks = extractCodeBlockSchemas(sampleMarkdown);
    const updated = replaceCodeBlockInMarkdown(sampleMarkdown, blocks[0], '{\n  "service": "updated"\n}');
    expect(updated).toContain('"service": "updated"');
    expect(updated).not.toContain('"service": "specforge-api"');
    expect(updated).toContain("# Core Architecture Spec");
  });

  it("parses markdown into structured sections", () => {
    const sections = parseMarkdownSections(sampleMarkdown);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe("Core Architecture Spec");
    expect(sections[1].title).toBe("API Endpoints");
  });

  it("generates a structured JSON export for specifications phase", () => {
    const exported = generatePhaseJsonExport({
      title: "Core Architecture Spec",
      type: "specifications",
      content: sampleMarkdown,
      phaseId: "specs",
    });

    expect(exported.type).toBe("specifications");
    expect(exported.title).toBe("Core Architecture Spec");
    expect(Array.isArray(exported.apiEndpoints)).toBe(true);
    expect((exported.apiEndpoints as Array<{ path: string }>)[0].path).toBe("/api/artifacts");
    expect(exported.hasExplicitTestSeams).toBe(true);
  });

  it("validates valid JSON and reports conformance score", () => {
    const validJson = JSON.stringify({
      $schema: "https://specforge.dev/schemas/sif/v1.json",
      title: "Test Spec",
      type: "specifications",
      apiEndpoints: [{ method: "GET", path: "/api/test" }],
    }, null, 2);

    const result = validateSchemaContent(validJson, "specs", sampleMarkdown);
    expect(result.isValid).toBe(true);
    expect(result.syntaxError).toBeNull();
    expect(result.conformanceScore).toBeGreaterThan(0);
    expect(result.conformanceChecks.length).toBeGreaterThan(0);
  });

  it("detects syntax errors with line and column information", () => {
    const invalidJson = '{\n  "name": "broken",\n}';
    const result = validateSchemaContent(invalidJson, "specs");
    expect(result.isValid).toBe(false);
    expect(result.syntaxError).not.toBeNull();
    expect(result.syntaxError?.message).toContain("JSON Syntax Error");
  });

  it("converts JSON to clean YAML format", () => {
    const data = {
      name: "specforge",
      enabled: true,
      endpoints: ["/api/v1", "/api/v2"],
      config: {
        timeout: 3000,
      },
    };

    const yaml = convertJsonToYaml(data);
    expect(yaml).toContain("name: specforge");
    expect(yaml).toContain("enabled: true");
    expect(yaml).toContain("- /api/v1");
    expect(yaml).toContain("timeout: 3000");
  });
});
