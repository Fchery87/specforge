"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const loading = isLoading || internalLoading;

  async function handleConfirm() {
    setInternalLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
    }
  }

  const IconComponent = variant === "destructive" ? Trash2 : AlertTriangle;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-scrim",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
            "rounded-lg border border-line bg-panel p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
          {/* Header with Icon */}
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-sm border",
                variant === "destructive"
                  ? "border-destructive bg-destructive/10"
                  : "border-warning bg-warning/10"
              )}
            >
              <IconComponent
                className={cn(
                  "size-5",
                  variant === "destructive" ? "text-destructive" : "text-warning"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="text-title font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-2 text-ui text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>

          {/* Close button */}
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 rounded-sm p-1 opacity-70 transition-opacity",
              "hover:opacity-100 disabled:pointer-events-none disabled:opacity-50"
            )}
            disabled={loading}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Hook for easier usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void | Promise<void>;
    variant?: "default" | "destructive";
  }>({
    open: false,
    title: "",
    onConfirm: () => {},
  });

  const confirm = React.useCallback(
    (options: {
      title: string;
      description?: string;
      onConfirm: () => void | Promise<void>;
      variant?: "default" | "destructive";
    }) => {
      setState({ ...options, open: true });
    },
    []
  );

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      title={state.title}
      description={state.description}
      onConfirm={state.onConfirm}
      variant={state.variant}
    />
  );

  return { confirm, dialog };
}
