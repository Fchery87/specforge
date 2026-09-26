"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  extractCodeBlockSchemas,
  replaceCodeBlockInMarkdown,
  generatePhaseJsonExport,
  validateSchemaContent,
  convertJsonToYaml,
  type CodeBlockSchema,
} from "@/lib/schema/phase-schema-extractor";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Code2,
  FileJson,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SchemaValidatorPanelProps {
  markdownContent: string;
  phaseId?: string;
  artifactTitle: string;
  artifactType: string;
  onApplyToMarkdown?: (updatedMarkdown: string) => void;
  onInsertSnippet?: (snippet: string) => void;
}

export function SchemaValidatorPanel({
  markdownContent,
  phaseId = "specs",
  artifactTitle,
  artifactType,
  onApplyToMarkdown,
  onInsertSnippet,
}: SchemaValidatorPanelProps) {
  const codeBlocks = useMemo(() => extractCodeBlockSchemas(markdownContent), [markdownContent]);

  const [targetMode, setTargetMode] = useState<"phase-export" | "code-block">("phase-export");
  const [selectedBlockId, setSelectedBlockId] = useState<string>(codeBlocks[0]?.id || "");
  const [formatMode, setFormatMode] = useState<"json" | "yaml">("json");
  const [schemaText, setSchemaText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCodeBlock = useMemo(() => {
    return codeBlocks.find((b) => b.id === selectedBlockId) || codeBlocks[0] || null;
  }, [codeBlocks, selectedBlockId]);

  // Generate initial schema text when mode or markdown changes
  useEffect(() => {
    if (targetMode === "phase-export") {
      const exportObj = generatePhaseJsonExport({
        title: artifactTitle,
        type: artifactType,
        content: markdownContent,
        phaseId,
      });

      if (formatMode === "yaml") {
        setSchemaText(convertJsonToYaml(exportObj));
      } else {
        setSchemaText(JSON.stringify(exportObj, null, 2));
      }
    } else if (selectedCodeBlock) {
      setSchemaText(selectedCodeBlock.content);
    }
  }, [targetMode, selectedCodeBlock, formatMode, artifactTitle, artifactType, markdownContent, phaseId]);

  // Validation results
  const validation = useMemo(() => {
    return validateSchemaContent(schemaText, phaseId, markdownContent);
  }, [schemaText, phaseId, markdownContent]);

  const lineCount = useMemo(() => {
    return schemaText.length === 0 ? 0 : schemaText.split("\n").length;
  }, [schemaText]);

  const handleFormat = () => {
    if (formatMode === "json") {
      try {
        const parsed = JSON.parse(schemaText);
        setSchemaText(JSON.stringify(parsed, null, 2));
        toast.success("JSON formatted successfully.");
      } catch (err) {
        toast.error("Cannot format invalid JSON syntax.");
      }
    } else {
      toast.info("YAML is already formatted.");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(schemaText);
    setCopied(true);
    toast.success("Schema copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToMarkdown = () => {
    if (!onApplyToMarkdown) return;

    if (targetMode === "code-block" && selectedCodeBlock) {
      const updatedMarkdown = replaceCodeBlockInMarkdown(
        markdownContent,
        selectedCodeBlock,
        schemaText
      );
      onApplyToMarkdown(updatedMarkdown);
      toast.success("Updated code block synced to markdown.");
    } else {
      // Append or inject phase JSON export block to the end of markdown
      const newBlock = `\n\n## Machine-Readable Schema Export\n\n\`\`\`json\n${schemaText}\n\`\`\`\n`;
      onApplyToMarkdown(markdownContent.trim() + newBlock);
      toast.success("Schema export appended to markdown specification.");
    }
  };

  const handleInsertQuickFix = (type: "error-envelope" | "test-seam" | "glossary" | "tracer-bullet") => {
    let snippet = "";
    switch (type) {
      case "error-envelope":
        snippet = `\n### Error Response Contract\n\n\`\`\`json\n{\n  "type": "https://specforge.dev/errors/validation-error",\n  "title": "Unprocessable Entity",\n  "status": 422,\n  "detail": "Input failed conformance validation.",\n  "instance": "/api/v1/artifacts/123"\n}\n\`\`\`\n`;
        break;
      case "test-seam":
        snippet = `\n### Explicit Test Seams\n\n- **Service Mock Seam:** Mockable interface for backend actions.\n- **Contract Test Seam:** OpenAPI request/response schema validator fixture.\n- **Error Injection:** Deterministic network latency and 500 error simulator.\n`;
        break;
      case "glossary":
        snippet = `\n### Domain Glossary\n\n- **TracerBullet:** End-to-end vertical slice verifying architecture seams.\n- **Artifact:** Immutable specification asset generated during phase runs.\n`;
        break;
      case "tracer-bullet":
        snippet = `\n### US-001: Implement Core Feature Tracer Bullet\n**Slice Type:** tracer_bullet\n**Blocked by:** none\n**Files to touch:** convex/schema.ts, components/feature.tsx, lib/feature.ts\n`;
        break;
    }

    if (onInsertSnippet) {
      onInsertSnippet(snippet);
      toast.success("Quick fix injected into markdown.");
    } else if (onApplyToMarkdown) {
      onApplyToMarkdown(markdownContent + snippet);
      toast.success("Quick fix appended to markdown.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = schemaText.substring(0, start) + "  " + schemaText.substring(end);
      setSchemaText(newText);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[62vh] overflow-hidden">
      {/* Left Column: Monaco-Style Schema Editor */}
      <div className="flex-1 flex flex-col border border-line rounded-lg bg-surface overflow-hidden">
        {/* Editor Controls Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-raised/40 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Target Mode Toggle */}
            <div className="flex items-center bg-raised/60 rounded-sm p-0.5 border border-line">
              <Button
                variant={targetMode === "phase-export" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-caption"
                onClick={() => setTargetMode("phase-export")}
              >
                <FileJson className="size-3.5 mr-1" />
                Phase Export
              </Button>
              <Button
                variant={targetMode === "code-block" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-caption"
                onClick={() => setTargetMode("code-block")}
                disabled={codeBlocks.length === 0}
              >
                <Code2 className="size-3.5 mr-1" />
                Code Blocks ({codeBlocks.length})
              </Button>
            </div>

            {/* Code Block Selector (if in code block mode) */}
            {targetMode === "code-block" && codeBlocks.length > 0 && (
              <select
                aria-label="Select Code Block"
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="h-6 px-2 text-caption bg-void border border-line rounded-sm text-ink focus:outline-none"
              >
                {codeBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    Line {b.startLine}: {b.language.toUpperCase()}
                  </option>
                ))}
              </select>
            )}

            {/* Format toggle (JSON vs YAML) */}
            {targetMode === "phase-export" && (
              <div className="flex items-center bg-raised/60 rounded-sm p-0.5 border border-line ml-1">
                <button
                  type="button"
                  onClick={() => setFormatMode("json")}
                  className={cn(
                    "px-2 py-0.5 text-caption rounded-sm font-mono font-medium transition-colors",
                    formatMode === "json"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-ink"
                  )}
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => setFormatMode("yaml")}
                  className={cn(
                    "px-2 py-0.5 text-caption rounded-sm font-mono font-medium transition-colors",
                    formatMode === "yaml"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-ink"
                  )}
                >
                  YAML
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            {formatMode === "json" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-caption"
                title="Format JSON with 2-space indentation"
                onClick={handleFormat}
              >
                Format
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-caption"
              title="Copy schema to clipboard"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="size-3.5 mr-1 text-sage" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5 mr-1" />
                  Copy
                </>
              )}
            </Button>

            {onApplyToMarkdown && (
              <Button
                variant="default"
                size="sm"
                className="h-6 px-2.5 text-caption bg-primary hover:bg-primary/90 text-primary-foreground"
                title="Apply schema changes back to the markdown specification"
                onClick={handleApplyToMarkdown}
              >
                Sync to Markdown
                <ArrowRight className="size-3 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Code Canvas Area with Line Numbers */}
        <div className="flex-1 flex overflow-hidden bg-void">
          {/* Line Numbers Gutter */}
          <div className="w-10 flex-shrink-0 select-none border-r border-line/60 bg-raised/20 py-3 text-right pr-2 font-mono text-caption text-muted-foreground/60 overflow-hidden leading-relaxed">
            {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Monaco-Style Textarea */}
          <Textarea
            ref={textareaRef}
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Schema definitions will render here..."
            className="flex-1 w-full p-3 font-mono text-caption sm:text-ui resize-none border-0 rounded-none bg-transparent leading-relaxed overflow-y-auto whitespace-pre font-normal"
            spellCheck={false}
          />
        </div>

        {/* Syntax Diagnostic Status Footer */}
        <div className="px-3 py-1.5 border-t border-line bg-raised/30 flex items-center justify-between text-caption">
          <div className="flex items-center gap-2">
            {validation.isValid ? (
              <Badge variant="outline" className="text-caption border-sage/30 text-sage dark:text-sage bg-sage/10">
                <CheckCircle2 className="size-3 mr-1" />
                Syntax Valid
              </Badge>
            ) : (
              <Badge variant="outline" className="text-caption border-destructive/40 text-destructive bg-destructive/10">
                <XCircle className="size-3 mr-1" />
                Syntax Error
              </Badge>
            )}

            {validation.syntaxError && (
              <span className="text-destructive text-caption font-mono truncate max-w-sm">
                Line {validation.syntaxError.line || 1}: {validation.syntaxError.message}
              </span>
            )}
          </div>

          <div className="text-muted-foreground text-caption">
            {lineCount} lines • {schemaText.length} characters
          </div>
        </div>
      </div>

      {/* Right Column: Schema Conformance & Quick-Fixes Sidebar */}
      <div className="w-full lg:w-80 flex flex-col border border-line rounded-lg bg-surface overflow-hidden flex-shrink-0">
        <div className="px-3 py-2 border-b border-line bg-raised/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" />
            <span className="text-caption font-semibold">Conformance Score</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-caption font-mono font-bold",
              validation.conformanceScore >= 80
                ? "border-sage/30 text-sage dark:text-sage bg-sage/10"
                : validation.conformanceScore >= 50
                ? "border-amber/30 text-amber bg-amber/10"
                : "border-destructive/40 text-destructive bg-destructive/10"
            )}
          >
            {validation.conformanceScore}%
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-3">
          <div className="space-y-4">
            {/* Conformance Check Items */}
            <div className="space-y-2">
              <h4 className="text-caption font-medium text-muted-foreground">
                Automated Checks
              </h4>
              <div className="space-y-1.5">
                {validation.conformanceChecks.map((check) => (
                  <div
                    key={check.id}
                    className="p-2 rounded-sm border border-line bg-raised/20 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-caption font-medium">
                      <span className="flex items-center gap-1.5 truncate">
                        {check.passed ? (
                          <CheckCircle2 className="size-3.5 text-sage flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="size-3.5 text-amber flex-shrink-0" />
                        )}
                        <span className="truncate">{check.name}</span>
                      </span>
                      <span className="text-caption font-mono text-muted-foreground">
                        {check.score}%
                      </span>
                    </div>

                    {check.issues.length > 0 && (
                      <ul className="text-caption text-muted-foreground list-disc pl-4 space-y-0.5 mt-1">
                        {check.issues.slice(0, 3).map((issue, idx) => (
                          <li key={idx} className="leading-snug">
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {validation.conformanceChecks.length === 0 && (
                  <p className="text-caption text-muted-foreground italic">
                    No active conformance rules configured for phase "{phaseId}".
                  </p>
                )}
              </div>
            </div>

            {/* Quick-Fix Injections */}
            <div className="space-y-2 pt-2 border-t border-line">
              <h4 className="text-caption font-medium text-muted-foreground flex items-center gap-1">
                <Wand2 className="size-3 text-primary" />
                Specification Quick-Fixes
              </h4>
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-caption justify-start"
                  onClick={() => handleInsertQuickFix("test-seam")}
                >
                  <Sparkles className="size-3 mr-1.5 text-primary" />
                  Add Explicit Test Seams
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-caption justify-start"
                  onClick={() => handleInsertQuickFix("error-envelope")}
                >
                  <Layers className="size-3 mr-1.5 text-primary" />
                  Add RFC 7807 Error Envelope
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-caption justify-start"
                  onClick={() => handleInsertQuickFix("glossary")}
                >
                  <Code2 className="size-3 mr-1.5 text-primary" />
                  Add Domain Glossary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-caption justify-start"
                  onClick={() => handleInsertQuickFix("tracer-bullet")}
                >
                  <ArrowRight className="size-3 mr-1.5 text-primary" />
                  Add Tracer Bullet Story
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
