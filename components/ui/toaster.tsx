"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-popover text-ink border border-line rounded-lg shadow-lg font-sans text-ui",
          title: "font-medium",
          description: "text-dim",
          success: "border-success/40",
          error: "border-destructive/40",
          warning: "border-warning/40",
          info: "border-info/40",
          actionButton: "bg-primary text-primary-foreground rounded-sm",
          cancelButton: "bg-raised text-ink rounded-sm",
        },
      }}
    />
  );
}
