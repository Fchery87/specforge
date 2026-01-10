"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, Trash2, Edit, Download, ChevronDown, ChevronUp, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Artifact = {
  _id: string;
  title: string;
  type: string;
  content: string;
  previewHtml: string;
  sections: Array<{ name: string; tokens: number; model: string }>;
  createdAt?: number;
};

interface ArtifactPreviewProps {
  artifact: Artifact;
  onDelete?: () => void;
  onEdit?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
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
  console.log("Downloading ZIP for artifact:", artifactId);
}

export function ArtifactPreview({ artifact, onDelete, onEdit }: ArtifactPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const deleteArtifact = useMutation(api.artifacts.deleteArtifact as any);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteArtifact({ artifactId: artifact._id as any });
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete artifact:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  const totalTokens = artifact.sections.reduce((sum, s) => sum + s.tokens, 0);

  return (
    <>
      <Card variant="static" className="border overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <CardTitle className="text-base normal-case tracking-normal font-semibold truncate">
                  {artifact.title}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {artifact.type}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {artifact.sections.length} section{artifact.sections.length !== 1 ? 's' : ''}
                </span>
                <span>~{totalTokens.toLocaleString()} tokens</span>
                {artifact.createdAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(artifact.createdAt)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        
        {expanded && (
          <CardContent className="space-y-4 border-t border-border pt-4">
            {/* Section breakdown */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Sections
              </h4>
              <div className="grid gap-2">
                {artifact.sections.map((section, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-secondary/30 border border-border text-sm"
                  >
                    <span className="font-medium">{section.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {section.tokens.toLocaleString()} tokens
                      </Badge>
                      <span>{section.model}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Preview
              </h4>
              <div
                className="prose prose-invert max-w-none text-sm p-4 bg-secondary/30 border border-border max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: artifact.previewHtml || "" }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => downloadMarkdown(artifact.content, artifact.title)}>
                <Download className="w-4 h-4 mr-2" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadZip(artifact._id, artifact.title)}>
                <Download className="w-4 h-4 mr-2" />
                ZIP
              </Button>
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        )}

        {/* Collapsed preview */}
        {!expanded && (
          <CardContent className="pt-0">
            <div
              className="prose prose-invert max-w-none text-sm line-clamp-2 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: artifact.previewHtml || "" }}
            />
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
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
    </>
  );
}
