/**
 * Phase Schema Extractor & Validator Engine
 *
 * Extracts, parses, converts, and validates structured schemas (JSON, YAML, SIF, OpenAPI)
 * from markdown specifications in SpecForge.
 */

import { SIF_SCHEMA_URL, SIF_SCHEMA_VERSION } from "../export/sif-schema";
import { apiSchemaValidator } from "../validation/conformance/api-schema-validator";
import { completenessChecker } from "../validation/conformance/completeness-checker";
import { securityCoverageValidator } from "../validation/conformance/security-coverage";

export interface CodeBlockSchema {
  id: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ValidationIssue {
  type: "error" | "warning" | "info";
  message: string;
  line?: number;
  column?: number;
}

export interface ConformanceCheckDetail {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  issues: string[];
}

export interface SchemaValidationResult {
  isValid: boolean;
  syntaxError: ValidationIssue | null;
  schemaIssues: ValidationIssue[];
  conformanceScore: number;
  conformanceChecks: ConformanceCheckDetail[];
}

/**
 * Extracts embedded code blocks with schema-relevant languages.
 */
export function extractCodeBlockSchemas(markdown: string): CodeBlockSchema[] {
  const codeBlocks: CodeBlockSchema[] = [];
  const lines = markdown.split("\n");
  let inBlock = false;
  let currentLanguage = "";
  let currentContent: string[] = [];
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^```([a-zA-Z0-9_-]*)/);

    if (match && !inBlock) {
      inBlock = true;
      currentLanguage = match[1].toLowerCase() || "text";
      currentContent = [];
      blockStartLine = i + 1;
    } else if (line.startsWith("```") && inBlock) {
      inBlock = false;
      const content = currentContent.join("\n");
      const blockId = `block-${blockStartLine}-${currentLanguage}`;
      codeBlocks.push({
        id: blockId,
        language: currentLanguage,
        content,
        startLine: blockStartLine,
        endLine: i + 1,
      });
    } else if (inBlock) {
      currentContent.push(line);
    }
  }

  return codeBlocks;
}

/**
 * Replaces a specific code block inside markdown with updated content.
 */
export function replaceCodeBlockInMarkdown(
  markdown: string,
  block: CodeBlockSchema,
  newContent: string
): string {
  const lines = markdown.split("\n");
  const beforeLines = lines.slice(0, block.startLine);
  const afterLines = lines.slice(block.endLine - 1);

  return [...beforeLines, newContent, ...afterLines].join("\n");
}

/**
 * Parses markdown headers and text sections into a key-value or structured document.
 */
export function parseMarkdownSections(markdown: string): Array<{ title: string; level: number; content: string }> {
  const sections: Array<{ title: string; level: number; content: string }> = [];
  const lines = markdown.split("\n");
  let currentTitle = "Overview";
  let currentLevel = 1;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      if (currentContent.length > 0 || sections.length > 0) {
        sections.push({
          title: currentTitle,
          level: currentLevel,
          content: currentContent.join("\n").trim(),
        });
      }
      currentLevel = headerMatch[1].length;
      currentTitle = headerMatch[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      title: currentTitle,
      level: currentLevel,
      content: currentContent.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Generates a structured JSON export representation for the current phase artifact.
 */
export function generatePhaseJsonExport(artifact: {
  title: string;
  type: string;
  content: string;
  phaseId?: string;
}): Record<string, unknown> {
  const { title, type, content, phaseId = "specs" } = artifact;
  const sections = parseMarkdownSections(content);
  const codeBlocks = extractCodeBlockSchemas(content);

  // Phase-specific structured schemas
  switch (phaseId) {
    case "constitution": {
      const principles = sections
        .filter((s) => /principle|truth|core|rule/i.test(s.title))
        .map((s) => ({ title: s.title, description: s.content }));
      const constraints = sections
        .filter((s) => /constraint|boundary|non-negotiable/i.test(s.title))
        .map((s) => s.content.split("\n").filter((l) => l.trim().startsWith("-")).map((l) => l.replace(/^[-*]\s*/, "")))
        .flat();

      return {
        $schema: SIF_SCHEMA_URL,
        version: SIF_SCHEMA_VERSION,
        type: "constitution",
        title,
        principles: principles.length > 0 ? principles : [{ title: "Core Architecture", description: "Immutable system truths." }],
        constraints: constraints.length > 0 ? constraints : ["Type-safe contracts", "Strict testing seams"],
        sections: sections.map((s) => ({ title: s.title, level: s.level, bodyLength: s.content.length })),
      };
    }

    case "domainModel": {
      // Extract entities, fields, relationships, and glossary
      const entityMatches = Array.from(content.matchAll(/###?\s+Entity:\s*([A-Za-z0-9_]+)/gi)).map((m) => m[1]);
      const glossaryMatches = Array.from(content.matchAll(/[-*]\s+\*\*([A-Za-z0-9_\s]+)\*\*:\s*(.+)/g)).map((m) => ({
        term: m[1],
        definition: m[2],
      }));

      return {
        $schema: SIF_SCHEMA_URL,
        version: SIF_SCHEMA_VERSION,
        type: "domainModel",
        title,
        entities: entityMatches.length > 0 ? entityMatches : ["User", "Workspace", "Artifact"],
        glossary: glossaryMatches.length > 0 ? glossaryMatches : [
          { term: "TracerBullet", definition: "End-to-end vertical slice touching schema, UI, API, and tests." },
        ],
        codeSchemas: codeBlocks.map((b) => ({ language: b.language, lines: b.endLine - b.startLine })),
        sections: sections.map((s) => ({ title: s.title, level: s.level })),
      };
    }

    case "stories": {
      // Extract vertical tracer bullets, slice types, blockedBy
      const storyMatches = Array.from(content.matchAll(/###?\s+(US-[0-9]+):\s*(.+)/gi)).map((m) => ({
        id: m[1],
        title: m[2],
      }));
      const tracerBullets = Array.from(content.matchAll(/Slice Type:\s*(tracer_bullet|wide_refactor)/gi)).map((m) => m[1]);

      return {
        $schema: SIF_SCHEMA_URL,
        version: SIF_SCHEMA_VERSION,
        type: "userStories",
        title,
        stories: storyMatches.length > 0 ? storyMatches : [
          { id: "US-001", title: "Vertical Tracer Bullet Implementation" },
        ],
        sliceTypesFound: tracerBullets,
        hasDependencyEdges: /Blocked by:/i.test(content),
        hasFilesToTouch: /Files to touch:/i.test(content),
      };
    }

    case "specs":
    default: {
      // Extract OpenAPI endpoints, database models, interfaces, test seams
      const endpointMatches = Array.from(content.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+([/][a-zA-Z0-9_{}/-]+)/g)).map((m) => ({
        method: m[1],
        path: m[2],
      }));
      const testSeams = Array.from(content.matchAll(/test\s+seam|mock\s+point|interface\s+contract/gi)).length > 0;

      return {
        $schema: SIF_SCHEMA_URL,
        version: SIF_SCHEMA_VERSION,
        type: "specifications",
        title,
        artifactType: type,
        apiEndpoints: endpointMatches.length > 0 ? endpointMatches : [
          { method: "GET", path: "/api/artifacts" },
          { method: "POST", path: "/api/artifacts" },
        ],
        hasExplicitTestSeams: testSeams,
        codeBlocks: codeBlocks.map((b) => ({
          language: b.language,
          lines: b.endLine - b.startLine,
        })),
        sections: sections.map((s) => ({ title: s.title, level: s.level })),
      };
    }
  }
}

/**
 * Validates a JSON schema string against syntax and phase conformance rules.
 */
export function validateSchemaContent(
  jsonOrYamlString: string,
  phaseId: string = "specs",
  originalMarkdown: string = ""
): SchemaValidationResult {
  let parsedObject: unknown = null;
  let syntaxError: ValidationIssue | null = null;
  const schemaIssues: ValidationIssue[] = [];

  // Parse JSON
  try {
    parsedObject = JSON.parse(jsonOrYamlString);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Parse line and column from error message if available
    let line: number | undefined;
    let column: number | undefined;

    const posMatch = errorMsg.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const linesBefore = jsonOrYamlString.slice(0, pos).split("\n");
      line = linesBefore.length;
      column = linesBefore[linesBefore.length - 1].length + 1;
    }

    syntaxError = {
      type: "error",
      message: `JSON Syntax Error: ${errorMsg}`,
      line,
      column,
    };
  }

  // If syntax is valid, check schema semantics
  if (parsedObject && typeof parsedObject === "object") {
    const obj = parsedObject as Record<string, unknown>;

    if (!obj.$schema) {
      schemaIssues.push({
        type: "warning",
        message: "Missing standard '$schema' field.",
      });
    }

    if (!obj.type && !obj.title) {
      schemaIssues.push({
        type: "warning",
        message: "Missing root 'type' or 'title' descriptor.",
      });
    }

    if (phaseId === "specs" && Array.isArray(obj.apiEndpoints) && obj.apiEndpoints.length === 0) {
      schemaIssues.push({
        type: "info",
        message: "Specification schema defines no API endpoints.",
      });
    }
  }

  // Run conformance validators on the original markdown content
  const contentToCheck = originalMarkdown || jsonOrYamlString;
  const conformanceChecks: ConformanceCheckDetail[] = [];

  const apiResult = apiSchemaValidator.validate(contentToCheck);
  if (apiSchemaValidator.appliesToPhases.includes(phaseId)) {
    conformanceChecks.push({
      id: apiSchemaValidator.id,
      name: apiSchemaValidator.name,
      passed: apiResult.passed,
      score: apiResult.score,
      issues: apiResult.issues,
    });
  }

  const completenessResult = completenessChecker.validate(contentToCheck);
  if (completenessChecker.appliesToPhases.includes(phaseId)) {
    conformanceChecks.push({
      id: completenessChecker.id,
      name: completenessChecker.name,
      passed: completenessResult.passed,
      score: completenessResult.score,
      issues: completenessResult.issues,
    });
  }

  const securityResult = securityCoverageValidator.validate(contentToCheck);
  if (securityCoverageValidator.appliesToPhases.includes(phaseId)) {
    conformanceChecks.push({
      id: securityCoverageValidator.id,
      name: securityCoverageValidator.name,
      passed: securityResult.passed,
      score: securityResult.score,
      issues: securityResult.issues,
    });
  }

  const totalScore = conformanceChecks.length > 0
    ? Math.round(conformanceChecks.reduce((sum, c) => sum + c.score, 0) / conformanceChecks.length)
    : 100;

  return {
    isValid: syntaxError === null,
    syntaxError,
    schemaIssues,
    conformanceScore: totalScore,
    conformanceChecks,
  };
}

/**
 * Lightweight, zero-dependency JSON to YAML formatter.
 */
export function convertJsonToYaml(value: unknown, indent: number = 0): string {
  const pad = "  ".repeat(indent);

  if (value === null) return "null";
  if (typeof value === "undefined") return "";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.includes("\n") || value.includes(":") || value.includes("#") || value.startsWith("-")) {
      return JSON.stringify(value);
    }
    return value.length === 0 ? '""' : value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const itemYaml = convertJsonToYaml(item, indent + 1).trimStart();
          return `${pad}- ${itemYaml}`;
        }
        return `${pad}- ${convertJsonToYaml(item, 0)}`;
      })
      .join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return `${pad}${k}:\n${convertJsonToYaml(v, indent + 1)}`;
        }
        if (Array.isArray(v)) {
          if (v.length === 0) return `${pad}${k}: []`;
          return `${pad}${k}:\n${convertJsonToYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${convertJsonToYaml(v, 0)}`;
      })
      .join("\n");
  }

  return String(value);
}
