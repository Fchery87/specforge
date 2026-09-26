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
          success: "border-sage/40",
          error: "border-brick/40",
          warning: "border-amber/40",
          info: "border-slate/40",
          actionButton: "bg-primary text-primary-foreground rounded-sm",
          cancelButton: "bg-raised text-ink rounded-sm",
        },
      }}
    />
  );
}
