"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StreamStatus = "idle" | "streaming" | "paused" | "complete" | "cancelled";

export function StreamingArtifactPreview(props: {
  title: string;
  previewHtml: string;
  streamStatus?: StreamStatus;
  currentSection?: string;
  sectionsCompleted?: number;
  sectionsTotal?: number;
}) {
  const {
    title,
    previewHtml,
    streamStatus,
    currentSection,
    sectionsCompleted,
    sectionsTotal,
  } = props;

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
            <CardTitle className="text-base normal-case tracking-normal font-semibold truncate">
              {title}
            </CardTitle>
            {typeof sectionsCompleted === "number" &&
              typeof sectionsTotal === "number" &&
              currentSection && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Section {sectionsCompleted + 1} of {sectionsTotal}:{" "}
                  <span className="text-white/80">{currentSection}</span>
                </div>
              )}
          </div>
          {statusLabel && (
            <Badge
              variant="outline"
              className={cn(
                statusLabel === "Live" && "border-border text-white/90",
                statusLabel === "Paused" && "border-border text-white/90",
                statusLabel === "Cancelled" && "border-border text-white/80"
              )}
            >
              {statusLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className="prose prose-invert max-w-none text-sm p-4 bg-secondary/30 border-t border-border max-h-96 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: previewHtml || "" }}
        />
      </CardContent>
    </Card>
  );
}
