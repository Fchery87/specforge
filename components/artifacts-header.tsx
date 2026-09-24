"use client";

import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StreamStatus = "idle" | "streaming" | "paused" | "complete" | "cancelled";

export function ArtifactsHeader(props: {
  streamStatus?: StreamStatus;
  hasArtifacts: boolean;
  onDownloadAll: () => void;
  isDownloading: boolean;
}) {
  const { streamStatus, hasArtifacts, onDownloadAll, isDownloading } = props;
  const showCancelled = streamStatus === "cancelled";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h2 className="text-v-h3 font-bold uppercase tracking-tighter">Artifacts</h2>
        {showCancelled && <Badge variant="outline">Cancelled</Badge>}
        {showCancelled && (
          <span className="text-xs text-muted-foreground">
            Partial output preserved. You can regenerate anytime.
          </span>
        )}
      </div>
      {hasArtifacts && (
        <Button variant="outline" size="sm" onClick={onDownloadAll} disabled={isDownloading} className="shrink-0">
          {isDownloading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Download className="w-4 h-4 mr-2" />
          Download All
        </Button>
      )}
    </div>
  );
}

