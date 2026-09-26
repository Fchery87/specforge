"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Square } from "lucide-react";

type StreamStatus = "idle" | "streaming" | "paused" | "complete" | "cancelled";

export function StreamingArtifactPreview(props: {
  title: string;
  previewHtml: string;
  streamStatus?: StreamStatus;
  currentSection?: string;
  sectionsCompleted?: number;
  sectionsTotal?: number;
  onCancel?: () => void;
  isCancelling?: boolean;
}) {
  const {
    title,
    previewHtml,
    streamStatus,
    currentSection,
    sectionsCompleted,
    sectionsTotal,
    onCancel,
    isCancelling,
  } = props;

  const isLive = streamStatus === "streaming";

  const statusLabel =
    streamStatus === "streaming"
      ? "Live"
      : streamStatus === "paused"
        ? "Paused"
        : streamStatus === "cancelled"
          ? "Cancelled"
          : null;

  return (
    <Card variant="static" className="border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-body font-semibold truncate">
              {title}
            </CardTitle>
            {typeof sectionsCompleted === "number" &&
              typeof sectionsTotal === "number" &&
              currentSection && (
                <div className="mt-1 text-caption text-muted-foreground">
                  Section {sectionsCompleted + 1} of {sectionsTotal}:{" "}
                  <span className="text-ink/80">{currentSection}</span>
                </div>
              )}
          </div>
          <div className="flex items-center gap-2">
            {isLive && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isCancelling}
                className="h-7 gap-1.5 text-caption border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isCancelling ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Square className="size-3" />
                )}
                {isCancelling ? "Stopping…" : "Stop"}
              </Button>
            )}
            {statusLabel && (
              <Badge
                variant="outline"
                className={cn(
                  statusLabel === "Live" && "border-line text-ink/90",
                  statusLabel === "Paused" && "border-line text-ink/90",
                  statusLabel === "Cancelled" && "border-line text-ink/80"
                )}
              >
                {statusLabel}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {previewHtml && previewHtml.trim().length > 0 ? (
          <div
            className="document-prose document-prose max-w-none text-ui p-4 bg-raised/30 border-t border-line max-h-96 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <div className="flex items-center justify-center p-8 bg-raised/30 border-t border-line text-ui text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Generating content preview…</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
