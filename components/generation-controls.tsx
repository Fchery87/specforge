"use client";

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectModelNote } from "@/components/generation-readiness-banner";

export function GenerationControls(props: {
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
  canResume?: boolean;
  onResume?: () => void;
  modelReady?: boolean;
}) {
  const {
    isGenerating,
    canGenerate,
    onGenerate,
    onCancel,
    isCancelling,
    canResume,
    onResume,
    modelReady = true,
  } = props;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pt-6 border-t border-line">
      <p className="text-ui text-muted-foreground">
        {!modelReady
          ? <ConnectModelNote />
          : canResume
          ? "Previous generation paused. You can resume from the last completed step."
          : canGenerate
            ? "All required questions answered."
            : "Answer required questions to generate."}
      </p>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        {isGenerating && onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling && <Loader2 className="size-4 mr-2 animate-spin" />}
            Cancel
          </Button>
        )}
        {canResume && onResume && !isGenerating && (
          <Button variant="outline" onClick={onResume} disabled={!modelReady}>
            <Play className="size-4 mr-2" />
            Resume Generation
          </Button>
        )}
        <Button onClick={onGenerate} disabled={!modelReady || !canGenerate || isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Phase"
          )}
        </Button>
      </div>
    </div>
  );
}

