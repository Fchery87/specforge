"use client";

import { renderMarkdownSafe } from "@/lib/markdown-render";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import { splitContentByMermaid } from "@/lib/mermaid-splitter";
import { cn } from "@/lib/utils";

interface MermaidAwareContentProps {
  markdown: string;
  className?: string;
}

export function MermaidAwareContent({ markdown, className }: MermaidAwareContentProps) {
  const segments = splitContentByMermaid(markdown);

  return (
    <div className={cn("space-y-4", className)}>
      {segments.map((segment, idx) => {
        if (segment.type === 'mermaid') {
          return (
            <MermaidDiagram
              key={idx}
              chart={segment.content}
              className="w-full"
            />
          );
        }
        return (
          <div
            key={idx}
            className="prose prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(segment.content) }}
          />
        );
      })}
    </div>
  );
}
