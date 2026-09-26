"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { updateArtifactAction, parseTicketsFromArtifactAction } from "@/lib/convex-actions";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MermaidAwareContent } from "@/components/ui/mermaid-aware-content";
import { renderPreviewHtml } from "@/lib/markdown-render";
import { estimateTokenCount } from "@/lib/llm/chunking";
import {
  Edit3,
  Eye,
  Columns,
  Code2,
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  CheckSquare,
  Table as TableIcon,
  Sparkles,
  Save,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SchemaValidatorPanel } from "@/components/schema-validator-panel";

export interface ArtifactEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: {
    _id: Id<"artifacts">;
    title: string;
    type: string;
    content: string;
    phaseId?: string;
  };
  projectId?: string;
  onSaved?: (updatedContent: string) => void;
}

export function ArtifactEditorModal({
  open,
  onOpenChange,
  artifact,
  projectId,
  onSaved,
}: ArtifactEditorModalProps) {
  const [content, setContent] = useState(artifact.content);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split" | "schema">("split");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateArtifact = useMutation(updateArtifactAction);
  const parseTickets = useAction(parseTicketsFromArtifactAction);

  useEffect(() => {
    if (open) {
      setContent(artifact.content);
    }
  }, [open, artifact.content, artifact._id]);

  const hasChanges = content !== artifact.content;
  const tokenCount = estimateTokenCount(content);
  const wordCount = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;
  const lineCount = content.length === 0 ? 0 : content.split("\n").length;

  const insertFormatting = (before: string, after: string = "", defaultPlaceholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = selectedText.length > 0 ? selectedText : defaultPlaceholder;
    const newText = content.substring(0, start) + before + replacement + after + content.substring(end);

    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + replacement.length;
      textarea.setSelectionRange(start + before.length, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = content.substring(0, start) + "  " + content.substring(end);
      setContent(newText);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const previewHtml = renderPreviewHtml(content);
      await updateArtifact({
        artifactId: artifact._id,
        content,
        previewHtml,
      });

      if (projectId && (artifact.phaseId === "stories" || artifact.type === "userStories")) {
        try {
          await parseTickets({
            projectId: projectId as Id<"projects">,
            artifactId: artifact._id,
          });
        } catch (ticketErr) {
          console.warn("Failed to re-parse tickets after artifact update:", ticketErr);
        }
      }

      toast.success("Artifact updated successfully.");
      onSaved?.(content);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save artifact changes.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-3 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Edit3 className="size-5 text-primary flex-shrink-0" />
                <DialogTitle className="text-title font-semibold truncate">
                  Edit {artifact.title}
                </DialogTitle>
                <Badge variant="outline" className="text-caption">
                  {artifact.type}
                </Badge>
                {hasChanges && (
                  <Badge variant="secondary" className="text-caption bg-amber/10 text-amber border border-amber/20">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-caption text-muted-foreground mt-1">
                Direct in-browser specification editing with real-time preview and diagram rendering.
              </DialogDescription>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-raised/50 rounded-lg p-1 border border-line">
              <Button
                variant={viewMode === "edit" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-caption"
                onClick={() => setViewMode("edit")}
              >
                <Edit3 className="size-3.5 mr-1" />
                Edit
              </Button>
              <Button
                variant={viewMode === "split" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-caption hidden md:flex"
                onClick={() => setViewMode("split")}
              >
                <Columns className="size-3.5 mr-1" />
                Split
              </Button>
              <Button
                variant={viewMode === "preview" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-caption"
                onClick={() => setViewMode("preview")}
              >
                <Eye className="size-3.5 mr-1" />
                Preview
              </Button>
              <Button
                variant={viewMode === "schema" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-caption"
                onClick={() => setViewMode("schema")}
              >
                <Code2 className="size-3.5 mr-1" />
                Schema
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 min-h-0 py-3">
          {viewMode === "split" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[60vh]">
              {/* Left Column: Editor */}
              <div className="flex flex-col border border-line rounded-lg bg-surface overflow-hidden">
                <EditorToolbar onInsert={insertFormatting} onReset={() => setContent(artifact.content)} hasChanges={hasChanges} />
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write your markdown specification here..."
                  className="flex-1 w-full p-4 font-mono text-caption sm:text-ui resize-none border-0 rounded-none bg-void leading-relaxed overflow-y-auto"
                />
              </div>

              {/* Right Column: Preview */}
              <div className="flex flex-col border border-line rounded-lg bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-line bg-raised/40 text-caption font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Live Specification Preview</span>
                  <Badge variant="outline" className="text-caption">
                    Mermaid Supported
                  </Badge>
                </div>
                <ScrollArea className="flex-1 p-4 bg-raised/10">
                  <MermaidAwareContent markdown={content} className="max-w-none text-ui" />
                </ScrollArea>
              </div>
            </div>
          )}

          {viewMode === "edit" && (
            <div className="flex flex-col h-[60vh] border border-line rounded-lg bg-surface overflow-hidden">
              <EditorToolbar onInsert={insertFormatting} onReset={() => setContent(artifact.content)} hasChanges={hasChanges} />
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write your markdown specification here..."
                className="flex-1 w-full p-4 font-mono text-caption sm:text-ui resize-none border-0 rounded-none bg-void leading-relaxed overflow-y-auto"
              />
            </div>
          )}

          {viewMode === "preview" && (
            <div className="flex flex-col h-[60vh] border border-line rounded-lg bg-surface overflow-hidden">
              <div className="px-3 py-2 border-b border-line bg-raised/40 text-caption font-semibold text-muted-foreground flex items-center justify-between">
                <span>Full Specification Preview</span>
                <Badge variant="outline" className="text-caption">
                  Mermaid & Markdown
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-6 bg-raised/10">
                <MermaidAwareContent markdown={content} className="max-w-none text-ui" />
              </ScrollArea>
            </div>
          )}

          {viewMode === "schema" && (
            <SchemaValidatorPanel
              markdownContent={content}
              phaseId={artifact.phaseId || "specs"}
              artifactTitle={artifact.title}
              artifactType={artifact.type}
              onApplyToMarkdown={(updated) => setContent(updated)}
              onInsertSnippet={(snippet) => {
                setContent((prev) => prev + snippet);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 pt-3 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-caption text-muted-foreground">
            <span>{lineCount.toLocaleString()} lines</span>
            <span>•</span>
            <span>{wordCount.toLocaleString()} words</span>
            <span>•</span>
            <span className="font-mono">~{tokenCount.toLocaleString()} tokens</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditorToolbar({
  onInsert,
  onReset,
  hasChanges,
}: {
  onInsert: (before: string, after?: string, defaultText?: string) => void;
  onReset: () => void;
  hasChanges: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-line bg-raised/40 overflow-x-auto gap-1">
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Heading 1"
          onClick={() => onInsert("# ", "", "Heading 1")}
        >
          <Heading1 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Heading 2"
          onClick={() => onInsert("## ", "", "Heading 2")}
        >
          <Heading2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Heading 3"
          onClick={() => onInsert("### ", "", "Heading 3")}
        >
          <Heading3 className="size-3.5" />
        </Button>

        <span className="w-[1px] h-4 bg-line mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Bold"
          onClick={() => onInsert("**", "**", "bold text")}
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Italic"
          onClick={() => onInsert("*", "*", "italic text")}
        >
          <Italic className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Inline Code"
          onClick={() => onInsert("`", "`", "code")}
        >
          <Code className="size-3.5" />
        </Button>

        <span className="w-[1px] h-4 bg-line mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-caption"
          title="Code Block"
          onClick={() => onInsert("```ts\n", "\n```", "// Code block")}
        >
          ```ts
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-caption"
          title="Insert Mermaid Diagram"
          onClick={() =>
            onInsert(
              "```mermaid\nflowchart TD\n  A[Start] --> B[Process]\n  B --> C[Result]\n```\n",
              "",
              ""
            )
          }
        >
          <Sparkles className="size-3 mr-1 text-primary" />
          Mermaid
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-caption"
          title="Insert Table"
          onClick={() =>
            onInsert(
              "| Column 1 | Column 2 |\n| :--- | :--- |\n| Value 1 | Value 2 |\n",
              "",
              ""
            )
          }
        >
          <TableIcon className="size-3.5 mr-1" />
          Table
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-caption"
          title="Insert Checklist"
          onClick={() => onInsert("- [ ] Task item\n", "", "")}
        >
          <CheckSquare className="size-3.5 mr-1" />
          Checklist
        </Button>
      </div>

      {hasChanges && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-caption text-muted-foreground hover:text-ink"
          title="Reset to original content"
          onClick={onReset}
        >
          <RotateCcw className="size-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
