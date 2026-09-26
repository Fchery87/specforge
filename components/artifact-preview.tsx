"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Download,
  Edit,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ArtifactDocument } from "@/components/artifact-document";
import { ArtifactEditorModal } from "@/components/artifact-editor-modal";

type CritiqueResult = {
  passes: boolean;
  score: number;
  summary: string;
  violations: Array<{
    category: string;
    severity: string;
    issue: string;
    suggestion: string;
  }>;
};

type Artifact = {
  _id: Id<'artifacts'>;
  title: string;
  type: string;
  content: string;
  previewHtml: string;
  sections: Array<{ name: string; tokens: number; model: string; critique?: CritiqueResult }>;
  phaseId?: string;
  createdAt?: number;
};

interface ArtifactPreviewProps {
  artifact: Artifact;
  projectId?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  defaultExpanded?: boolean;
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadZip(artifactId: string, title: string) {
  console.log("Downloading ZIP for artifact:", artifactId, title);
}

/**
 * A generated artifact, presented as a document.
 *
 * The header carries the artefact's identity and its actions, and the body is the reading surface.
 * Section critique is review data rather than prose, so it sits behind a disclosure instead of in
 * front of the document.
 */
export function ArtifactPreview({
  artifact,
  projectId,
  onDelete,
  onEdit,
  defaultExpanded = true,
}: ArtifactPreviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const deleteArtifact = useMutation(api.artifacts.deleteArtifact);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteArtifact({ artifactId: artifact._id });
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete artifact:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  const totalTokens = artifact.sections.reduce((sum, s) => sum + s.tokens, 0);
  const critiqued = artifact.sections.filter((section) => section.critique);

  return (
    <>
      <article>
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <FileText aria-hidden className="size-4 shrink-0 text-dim" />
              <h3 className="text-title font-medium text-ink">{artifact.title}</h3>
              <Badge variant="outline">{artifact.type}</Badge>
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-caption tabular-nums text-dim">
              <span>
                {artifact.sections.length} section
                {artifact.sections.length !== 1 ? "s" : ""}
              </span>
              <span>~{totalTokens.toLocaleString()} tokens</span>
              {artifact.createdAt ? <span>{formatRelativeTime(artifact.createdAt)}</span> : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (onEdit) {
                  onEdit();
                } else {
                  setIsEditorOpen(true);
                }
              }}
            >
              <Edit aria-hidden className="size-3.5" />
              Edit and validate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadMarkdown(artifact.content, artifact.title)}
            >
              <Download aria-hidden className="size-3.5" />
              Markdown
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadZip(artifact._id, artifact.title)}
            >
              <Download aria-hidden className="size-3.5" />
              ZIP
            </Button>
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${artifact.title}`}
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="text-brick hover:bg-brick/10"
              >
                {isDeleting ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden className="size-4" />
                )}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse artifact" : "Expand artifact"}
              onClick={() => setExpanded((current) => !current)}
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 transition-transform duration-(--duration-quick) ease-(--ease-quiet-out)",
                  expanded && "rotate-180"
                )}
              />
            </Button>
          </div>
        </header>

        {expanded ? (
          <div className="mt-8">
            <ArtifactDocument markdown={artifact.content} title={artifact.title} />
          </div>
        ) : artifact.previewHtml ? (
          <div
            className="document-prose mt-5 line-clamp-2 text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: artifact.previewHtml }}
          />
        ) : null}

        {expanded && critiqued.length > 0 ? (
          <Collapsible className="mt-10 border-t border-line pt-5">
            <CollapsibleTrigger className="flex items-center gap-2 text-label text-dim">
              <ChevronDown aria-hidden className="size-3.5" />
              Section critique
              <span className="font-mono tabular-nums">{critiqued.length}</span>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 flex flex-col gap-3">
              {artifact.sections.map((section, index) => (
                <div key={`${section.name}-${index}`} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-ui text-ink">{section.name}</span>
                    {section.critique ? (
                      <span
                        className={cn(
                          "font-mono text-caption tabular-nums",
                          section.critique.passes ? "text-sage" : "text-brick"
                        )}
                      >
                        {section.critique.score}/100
                      </span>
                    ) : null}
                    <span className="font-mono text-caption tabular-nums text-dim">
                      {section.tokens.toLocaleString()} tokens
                    </span>
                    <span className="font-mono text-caption text-dim">{section.model}</span>
                  </div>

                  {section.critique && !section.critique.passes && section.critique.violations?.length > 0 ? (
                    <ul className="flex flex-col gap-1 border-l border-brick/40 pl-4">
                      {section.critique.violations.map((violation, violationIndex) => (
                        <li key={violationIndex} className="text-caption text-muted-foreground">
                          <span className="text-brick">[{violation.category}]</span> {violation.issue}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </article>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Artifact"
        description={`Are you sure you want to delete "${artifact.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isDeleting}
      />

      <ArtifactEditorModal
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        artifact={artifact}
        projectId={projectId}
      />
    </>
  );
}
