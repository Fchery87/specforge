"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerationControls(props: {
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
}) {
  const { isGenerating, canGenerate, onGenerate, onCancel, isCancelling } = props;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-border">
      <p className="text-sm text-muted-foreground">
        {canGenerate ? "All required questions answered" : "Answer required questions to generate"}
      </p>
      <div className="flex items-center gap-2">
        {isGenerating && onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cancel
          </Button>
        )}
        <Button onClick={onGenerate} disabled={!canGenerate || isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

