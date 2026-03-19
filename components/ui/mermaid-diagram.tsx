"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!chart.trim()) return;
      setError(null);

      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "neutral",
            securityLevel: "strict",
          });
          mermaidInitialized = true;
        }

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, chart.trim());

        if (!cancelled) {
          setSvg(rendered);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setSvg(null);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div className={cn("p-3 border border-destructive/30 bg-destructive/10 text-sm text-destructive font-mono", className)}>
        <p className="font-semibold mb-1">Diagram error</p>
        <p className="text-xs opacity-80">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={cn("flex items-center justify-center h-24 text-sm text-muted-foreground border border-border/50 bg-secondary/20", className)}>
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("mermaid-diagram overflow-auto", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
