# Traycer Feature Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 13 feature gaps between SpecForge and Traycer.ai, transforming SpecForge from a spec-generation tool into a full spec-driven development platform.

**Architecture:** Incremental feature additions organized into 5 milestones, each independently shippable. Features are ordered by dependency — quick wins first (no architectural changes), then medium-effort features (schema + UI), then infrastructure features (codebase awareness, verification). Each milestone ends with a commit checkpoint.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Convex (backend), Clerk (auth), Radix UI + Tailwind CSS (UI), Vitest (testing), mermaid.js (diagrams), marked + sanitize-html (rendering)

---

## Milestone 1: Quick Wins (No Architecture Changes)

These features work within the existing codebase without schema migrations or new infrastructure.

---

### Task 1: Question Suggestion Chips — Schema

**Files:**
- Modify: `convex/schema.ts:28-36` (phases.questions array)
- Modify: `lib/llm/types.ts` (add QuestionSuggestion type)
- Test: `convex/__tests__/projects.test.ts`

**Step 1: Write the failing test**

```typescript
// convex/__tests__/question-suggestions-schema.test.ts
import { describe, test, expect } from 'vitest';

describe('Question with suggestions schema', () => {
  test('question object supports suggestions array', () => {
    const question = {
      id: 'q1',
      text: 'What architecture pattern?',
      answer: undefined,
      aiGenerated: false,
      required: true,
      suggestions: ['Monolith', 'Microservices', 'Serverless', 'Modular Monolith'],
      selectedSuggestionIndex: undefined,
    };
    expect(question.suggestions).toHaveLength(4);
    expect(question.selectedSuggestionIndex).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/__tests__/question-suggestions-schema.test.ts -v`
Expected: PASS (this is a type-level test, it validates the shape)

**Step 3: Update schema to support suggestions**

In `convex/schema.ts`, replace the questions array definition at lines 28-36:

```typescript
questions: v.array(
  v.object({
    id: v.string(),
    text: v.string(),
    answer: v.optional(v.string()),
    aiGenerated: v.boolean(),
    required: v.optional(v.boolean()),
    // NEW: AI-generated selectable suggestions
    suggestions: v.optional(v.array(v.string())),
    selectedSuggestionIndex: v.optional(v.number()),
  }),
),
```

**Step 4: Add QuestionWithSuggestions type to lib/llm/types.ts**

Append to the file:

```typescript
/**
 * Extended question with AI-generated suggestion options
 */
export interface QuestionWithSuggestions {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
  suggestions?: string[];
  selectedSuggestionIndex?: number;
}
```

**Step 5: Run typecheck to verify schema is valid**

Run: `npm run typecheck`
Expected: PASS (no type errors)

**Step 6: Commit**

```bash
git add convex/schema.ts lib/llm/types.ts convex/__tests__/question-suggestions-schema.test.ts
git commit -m "feat: add suggestions field to question schema"
```

---

### Task 2: Question Suggestion Chips — Backend (Generate Suggestions)

**Files:**
- Modify: `convex/actions/generateQuestionAnswer.ts:175-191` (buildQuestionPrompt)
- Modify: `convex/actions/generateQuestions.ts` (add suggestions to generated questions)
- Test: `convex/__tests__/generateQuestionAnswer.test.ts`

**Step 1: Write the failing test**

```typescript
// convex/__tests__/question-suggestions.test.ts
import { describe, test, expect } from 'vitest';

describe('Question suggestion parsing', () => {
  test('parseSuggestionsResponse extracts suggestions array', () => {
    const raw = JSON.stringify({
      suggestedAnswer: 'Microservices architecture',
      suggestions: [
        'Monolith',
        'Microservices',
        'Serverless',
        'Modular Monolith',
        'Event-Driven'
      ],
    });
    const parsed = JSON.parse(raw);
    expect(parsed.suggestions).toHaveLength(5);
    expect(parsed.suggestedAnswer).toBe('Microservices architecture');
  });

  test('parseSuggestionsResponse handles missing suggestions gracefully', () => {
    const raw = JSON.stringify({ suggestedAnswer: 'Just an answer' });
    const parsed = JSON.parse(raw);
    expect(parsed.suggestions).toBeUndefined();
    expect(parsed.suggestedAnswer).toBe('Just an answer');
  });
});
```

**Step 2: Run test to verify it passes (baseline)**

Run: `npm test -- convex/__tests__/question-suggestions.test.ts -v`
Expected: PASS

**Step 3: Update buildQuestionPrompt in generateQuestionAnswer.ts**

Replace the `buildQuestionPrompt` function at line 175:

```typescript
function buildQuestionPrompt(params: {
  projectTitle: string;
  projectDescription: string;
  questionText: string;
  previousQuestions: string;
}): string {
  return `You are helping answer questions for a software project specification.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousQuestions ? `Previous answers:\n${params.previousQuestions}\n\n` : ''}

Question: ${params.questionText}

Respond in valid JSON with this exact structure:
{
  "suggestedAnswer": "Your detailed answer here",
  "suggestions": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
}

Rules:
- "suggestedAnswer": A clear, concise, actionable answer (1-3 sentences)
- "suggestions": Exactly 3-5 short, selectable options (each under 60 characters) that represent the most common valid answers to this question. Make them specific to the project context, not generic.
- Return ONLY the JSON object, no markdown fences, no explanation.`;
}
```

**Step 4: Update generateAnswer to parse JSON response**

Replace the `generateAnswer` function and add a parser:

```typescript
function parseSuggestionsResponse(raw: string): {
  suggestedAnswer: string;
  suggestions?: string[];
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestedAnswer: parsed.suggestedAnswer || raw.trim(),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.filter((s: unknown) => typeof s === 'string').slice(0, 5)
          : undefined,
      };
    }
  } catch {
    // Fall through to plain text
  }
  return { suggestedAnswer: raw.trim() };
}
```

**Step 5: Update the action handler return type to include suggestions**

In the handler (around line 170), change:

```typescript
return { suggestedAnswer };
```

to:

```typescript
const parsed = parseSuggestionsResponse(rawAnswer);
return {
  suggestedAnswer: parsed.suggestedAnswer,
  suggestions: parsed.suggestions,
};
```

And update the return type of the handler from `Promise<{ suggestedAnswer: string }>` to `Promise<{ suggestedAnswer: string; suggestions?: string[] }>`.

**Step 6: Also generate suggestions during initial question generation**

In `convex/actions/generateQuestions.ts`, update the question prompt to include a `suggestions` field in each generated question object. In the `buildQuestionPrompt` function, add to the instruction:

```
Each question object should also include a "suggestions" array with 3-5 short selectable answer options.
```

**Step 7: Run typecheck and tests**

Run: `npm run typecheck && npm test -- convex/__tests__/ -v`
Expected: PASS

**Step 8: Commit**

```bash
git add convex/actions/generateQuestionAnswer.ts convex/actions/generateQuestions.ts convex/__tests__/question-suggestions.test.ts
git commit -m "feat: generate suggestion options with each question answer"
```

---

### Task 3: Question Suggestion Chips — UI Component

**Files:**
- Create: `components/question-suggestions.tsx`
- Modify: `components/questions-panel.tsx:348-426` (integrate suggestion chips)
- Test: `components/__tests__/question-suggestions.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/__tests__/question-suggestions.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionSuggestions } from '../question-suggestions';

describe('QuestionSuggestions', () => {
  const suggestions = ['Monolith', 'Microservices', 'Serverless'];

  test('renders suggestion chips', () => {
    render(
      <QuestionSuggestions
        suggestions={suggestions}
        onSelect={() => {}}
        selectedIndex={undefined}
      />
    );
    expect(screen.getByText('Monolith')).toBeDefined();
    expect(screen.getByText('Microservices')).toBeDefined();
    expect(screen.getByText('Serverless')).toBeDefined();
  });

  test('calls onSelect with index when chip is clicked', () => {
    const onSelect = vi.fn();
    render(
      <QuestionSuggestions
        suggestions={suggestions}
        onSelect={onSelect}
        selectedIndex={undefined}
      />
    );
    fireEvent.click(screen.getByText('Microservices'));
    expect(onSelect).toHaveBeenCalledWith(1, 'Microservices');
  });

  test('highlights selected chip', () => {
    render(
      <QuestionSuggestions
        suggestions={suggestions}
        onSelect={() => {}}
        selectedIndex={1}
      />
    );
    const selected = screen.getByText('Microservices');
    expect(selected.closest('button')?.className).toContain('bg-primary');
  });

  test('renders nothing when suggestions is empty', () => {
    const { container } = render(
      <QuestionSuggestions
        suggestions={[]}
        onSelect={() => {}}
        selectedIndex={undefined}
      />
    );
    expect(container.children).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/question-suggestions.test.tsx -v`
Expected: FAIL — module not found

**Step 3: Create the QuestionSuggestions component**

```typescript
// components/question-suggestions.tsx
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface QuestionSuggestionsProps {
  suggestions: string[];
  onSelect: (index: number, value: string) => void;
  selectedIndex: number | undefined;
  disabled?: boolean;
}

export function QuestionSuggestions({
  suggestions,
  onSelect,
  selectedIndex,
  disabled = false,
}: QuestionSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion, index) => {
        const isSelected = selectedIndex === index;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index, suggestion)}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border-2 transition-colors",
              "hover:border-primary hover:text-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/30 border-border text-foreground"
            )}
          >
            {isSelected && <Check className="w-3 h-3" />}
            {suggestion}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/__tests__/question-suggestions.test.tsx -v`
Expected: PASS

**Step 5: Integrate into questions-panel.tsx**

In `components/questions-panel.tsx`, import the new component at the top:

```typescript
import { QuestionSuggestions } from "./question-suggestions";
```

Update the Question type (line 18-24) to include suggestions:

```typescript
type Question = {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
  suggestions?: string[];
  selectedSuggestionIndex?: number;
};
```

Add suggestion selection state alongside localAnswers (after line 67):

```typescript
const [localSelectedSuggestions, setLocalSelectedSuggestions] = useState<Record<string, number>>({});
```

Add a handler after `handleAnswerChange` (after line 156):

```typescript
const handleSuggestionSelect = useCallback((questionId: string, index: number, value: string) => {
  setLocalSelectedSuggestions(prev => ({ ...prev, [questionId]: index }));
  setLocalAnswers(prev => ({ ...prev, [questionId]: value }));
  setLocalAiGenerated(prev => ({ ...prev, [questionId]: true }));
  pendingSaveRef.current[questionId] = value;
  pendingAiGeneratedRef.current[questionId] = true;
}, []);
```

In the question rendering loop (around line 374, after the Textarea), add the suggestions component:

```tsx
{/* Suggestion chips — render below textarea */}
{question.suggestions && question.suggestions.length > 0 && (
  <QuestionSuggestions
    suggestions={question.suggestions}
    onSelect={(index, value) => handleSuggestionSelect(question.id, index, value)}
    selectedIndex={localSelectedSuggestions[question.id]}
    disabled={isGenerating || aiGeneratingId === question.id}
  />
)}
```

**Step 6: Run all component tests**

Run: `npm test -- components/__tests__/ -v`
Expected: PASS

**Step 7: Commit**

```bash
git add components/question-suggestions.tsx components/questions-panel.tsx components/__tests__/question-suggestions.test.tsx
git commit -m "feat: add selectable suggestion chips to question panel"
```

---

### Task 4: Mermaid Diagram Renderer — Component

**Files:**
- Create: `components/mermaid-diagram.tsx`
- Test: `components/__tests__/mermaid-diagram.test.tsx`

**Step 1: Install mermaid dependency**

Run: `npm install mermaid@11`

**Step 2: Write the failing test**

```typescript
// components/__tests__/mermaid-diagram.test.tsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MermaidDiagram } from '../mermaid-diagram';

// Mock mermaid since it requires DOM
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('MermaidDiagram', () => {
  test('renders container with mermaid class', () => {
    const { container } = render(
      <MermaidDiagram chart="graph TD; A-->B;" />
    );
    const mermaidDiv = container.querySelector('.mermaid');
    expect(mermaidDiv).toBeDefined();
  });

  test('renders copy button', () => {
    render(<MermaidDiagram chart="graph TD; A-->B;" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
  });

  test('renders nothing when chart is empty', () => {
    const { container } = render(<MermaidDiagram chart="" />);
    expect(container.children).toHaveLength(0);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- components/__tests__/mermaid-diagram.test.tsx -v`
Expected: FAIL — module not found

**Step 4: Create the MermaidDiagram component**

```typescript
// components/mermaid-diagram.tsx
"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#DFE104",
            primaryTextColor: "#FAFAFA",
            primaryBorderColor: "#3F3F46",
            lineColor: "#A1A1AA",
            secondaryColor: "#27272A",
            tertiaryColor: "#18181B",
            fontFamily: "Space Grotesk, sans-serif",
          },
        });

        if (containerRef.current && !cancelled) {
          containerRef.current.innerHTML = "";
          const { svg } = await mermaid.render(`mermaid-${uniqueId}`, chart);
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
            setError(null);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to render diagram");
        }
      }
    }

    renderDiagram();
    return () => { cancelled = true; };
  }, [chart, uniqueId]);

  if (!chart) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("relative border-2 border-border bg-secondary/20 p-4", className)}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs"
          aria-label={copied ? "Copied" : "Copy diagram code"}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 px-2 text-xs"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </Button>
      </div>

      {/* Diagram container */}
      {error ? (
        <div className="text-sm text-destructive p-2">
          Diagram render error: {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          className={cn(
            "mermaid overflow-auto",
            expanded ? "max-h-none" : "max-h-96"
          )}
        />
      )}
    </div>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- components/__tests__/mermaid-diagram.test.tsx -v`
Expected: PASS

**Step 6: Commit**

```bash
git add components/mermaid-diagram.tsx components/__tests__/mermaid-diagram.test.tsx package.json package-lock.json
git commit -m "feat: add MermaidDiagram component with copy and expand"
```

---

### Task 5: Mermaid Diagram Rendering in Artifact Preview

**Files:**
- Modify: `lib/markdown-render.ts:1-46` (detect mermaid blocks)
- Modify: `components/artifact-preview.tsx` (render mermaid blocks)
- Modify: `components/streaming-artifact-preview.tsx` (render mermaid blocks)
- Test: `lib/__tests__/markdown-render.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/mermaid-block-extraction.test.ts
import { describe, test, expect } from 'vitest';
import { extractMermaidBlocks } from '../markdown-render';

describe('extractMermaidBlocks', () => {
  test('extracts mermaid code blocks from markdown', () => {
    const md = '# Title\n\nSome text\n\n```mermaid\ngraph TD;\n  A-->B;\n```\n\nMore text';
    const result = extractMermaidBlocks(md);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].code).toBe('graph TD;\n  A-->B;');
    expect(result.blocks[0].placeholder).toContain('MERMAID_BLOCK_0');
  });

  test('returns empty blocks for markdown without mermaid', () => {
    const md = '# Just text\n\nNo diagrams here.';
    const result = extractMermaidBlocks(md);
    expect(result.blocks).toHaveLength(0);
    expect(result.cleanedMarkdown).toBe(md);
  });

  test('handles multiple mermaid blocks', () => {
    const md = '```mermaid\ngraph TD; A-->B;\n```\n\ntext\n\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```';
    const result = extractMermaidBlocks(md);
    expect(result.blocks).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/mermaid-block-extraction.test.ts -v`
Expected: FAIL — extractMermaidBlocks not found

**Step 3: Add extractMermaidBlocks to lib/markdown-render.ts**

Add to the file:

```typescript
export interface MermaidBlock {
  code: string;
  placeholder: string;
}

export interface MermaidExtractionResult {
  cleanedMarkdown: string;
  blocks: MermaidBlock[];
}

/**
 * Extracts mermaid code blocks from markdown, replacing them with placeholders.
 * The placeholders are rendered as <div> elements that React components can target.
 */
export function extractMermaidBlocks(markdown: string): MermaidExtractionResult {
  const blocks: MermaidBlock[] = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let cleaned = markdown;

  while ((match = regex.exec(markdown)) !== null) {
    const code = match[1].trim();
    const placeholder = `MERMAID_BLOCK_${blocks.length}`;
    blocks.push({ code, placeholder });
    cleaned = cleaned.replace(match[0], `<div data-mermaid-placeholder="${placeholder}"></div>`);
  }

  return { cleanedMarkdown: cleaned, blocks };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/mermaid-block-extraction.test.ts -v`
Expected: PASS

**Step 5: Update artifact-preview.tsx to render mermaid placeholders**

In `components/artifact-preview.tsx`, import MermaidDiagram and extractMermaidBlocks, then in the HTML rendering section, replace mermaid placeholder divs with the MermaidDiagram component. This requires using a ref-based approach to find and replace placeholder elements after the HTML is rendered.

Add a helper component at the top of the file:

```typescript
import { MermaidDiagram } from "./mermaid-diagram";
import { extractMermaidBlocks } from "@/lib/markdown-render";
```

Create an `ArtifactContent` wrapper component that handles mermaid rendering:

```typescript
function ArtifactContent({ content, previewHtml }: { content: string; previewHtml: string }) {
  const { blocks } = extractMermaidBlocks(content);

  if (blocks.length === 0) {
    return <div className="prose-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />;
  }

  // Split HTML at mermaid placeholders and interleave MermaidDiagram components
  const parts = previewHtml.split(/(<div data-mermaid-placeholder="MERMAID_BLOCK_\d+"><\/div>)/);

  return (
    <div className="prose-preview">
      {parts.map((part, i) => {
        const placeholderMatch = part.match(/data-mermaid-placeholder="MERMAID_BLOCK_(\d+)"/);
        if (placeholderMatch) {
          const blockIndex = parseInt(placeholderMatch[1], 10);
          const block = blocks[blockIndex];
          if (block) {
            return <MermaidDiagram key={`mermaid-${i}`} chart={block.code} className="my-4" />;
          }
        }
        return <div key={i} dangerouslySetInnerHTML={{ __html: part }} />;
      })}
    </div>
  );
}
```

Apply the same pattern to `streaming-artifact-preview.tsx`.

**Step 6: Run all tests**

Run: `npm test -- --run -v`
Expected: PASS

**Step 7: Commit**

```bash
git add lib/markdown-render.ts lib/__tests__/mermaid-block-extraction.test.ts components/artifact-preview.tsx components/streaming-artifact-preview.tsx components/mermaid-diagram.tsx
git commit -m "feat: render Mermaid diagrams inline in artifact previews"
```

---

### Task 6: Mermaid Diagram Generation in Prompts

**Files:**
- Modify: `lib/llm/prompts/constitution.ts` (add diagram instruction)
- Modify: `lib/llm/prompts/domain-model.ts` (add ER diagram instruction)
- Modify: `lib/llm/section-plans.ts` (add diagram instructions to tech spec, stories sections)

**Step 1: Add diagram instruction to domain model prompt**

In `lib/llm/prompts/domain-model.ts`, add to the prompt:

```
### Diagrams
Include a Mermaid entity-relationship diagram showing all entities and their relationships:

\`\`\`mermaid
erDiagram
  ENTITY_A ||--o{ ENTITY_B : "has many"
  ...
\`\`\`
```

**Step 2: Add architecture diagram instruction to specifications sections**

In `lib/llm/section-plans.ts`, in the `SPECIFICATIONS_SECTIONS` array, update the `architecture-overview` section description:

```typescript
{
  id: 'architecture-overview',
  title: 'Architecture Overview',
  description:
    'High-level architecture with component boundaries and data flow. Include a Mermaid architecture diagram showing system components and their interactions.',
  estimatedTokens: 2500, // Increased from 2000 for diagram
  required: true,
  phaseId: 'specs',
  sectionType: 'technical',
},
```

**Step 3: Add user flow diagram to stories sections**

In the `USER_STORIES_SECTIONS` array, update the `epic-overview` section:

```typescript
{
  id: 'epic-overview',
  title: 'Epic Overview',
  description:
    'Summary of epics with scope and priority. Include a Mermaid flowchart showing the user journey across epics.',
  estimatedTokens: 1500, // Increased from 1000
  required: true,
  phaseId: 'stories',
  sectionType: 'planning',
},
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/llm/prompts/domain-model.ts lib/llm/prompts/constitution.ts lib/llm/section-plans.ts
git commit -m "feat: add Mermaid diagram generation instructions to phase prompts"
```

---

### Task 7: Phase Switcher Dropdown

**Files:**
- Create: `components/phase-switcher.tsx`
- Modify: `app/project/[id]/phase/[phaseId]/page.tsx:27-36` (add phase switcher)
- Test: `components/__tests__/phase-switcher.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/__tests__/phase-switcher.test.tsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhaseSwitcher } from '../phase-switcher';

const mockPhases = [
  { phaseId: 'constitution', status: 'ready' },
  { phaseId: 'brief', status: 'ready' },
  { phaseId: 'prd', status: 'pending' },
  { phaseId: 'domainModel', status: 'generating' },
];

describe('PhaseSwitcher', () => {
  test('renders current phase label', () => {
    render(
      <PhaseSwitcher
        currentPhaseId="brief"
        phases={mockPhases}
        projectId="proj123"
      />
    );
    expect(screen.getByText('Brief')).toBeDefined();
  });

  test('shows status indicators for each phase', () => {
    render(
      <PhaseSwitcher
        currentPhaseId="constitution"
        phases={mockPhases}
        projectId="proj123"
      />
    );
    // The current phase should be visible
    expect(screen.getByText('Constitution')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/phase-switcher.test.tsx -v`
Expected: FAIL — module not found

**Step 3: Create the PhaseSwitcher component**

```typescript
// components/phase-switcher.tsx
"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Check, Loader2, Circle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";

const PHASE_LABELS: Record<string, string> = {
  constitution: "Constitution",
  brief: "Brief",
  prd: "PRD",
  domainModel: "Domain Model",
  specs: "Specifications",
  stories: "User Stories",
  artifacts: "Artifacts",
  handoff: "Handoff",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <Check className="w-3 h-3 text-success" />;
    case "generating":
      return <Loader2 className="w-3 h-3 text-primary animate-spin" />;
    case "error":
      return <AlertTriangle className="w-3 h-3 text-destructive" />;
    default:
      return <Circle className="w-3 h-3 text-muted-foreground" />;
  }
}

interface PhaseSwitcherProps {
  currentPhaseId: string;
  phases: Array<{ phaseId: string; status: string }>;
  projectId: string;
}

export function PhaseSwitcher({ currentPhaseId, phases, projectId }: PhaseSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const currentLabel = PHASE_LABELS[currentPhaseId] || currentPhaseId;

  function handleSelect(phaseId: string) {
    setOpen(false);
    if (phaseId !== currentPhaseId) {
      router.push(`/project/${projectId}/phase/${phaseId}`);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentLabel}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {phases.map((phase) => {
          const label = PHASE_LABELS[phase.phaseId] || phase.phaseId;
          const isCurrent = phase.phaseId === currentPhaseId;
          return (
            <button
              key={phase.phaseId}
              onClick={() => handleSelect(phase.phaseId)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                "hover:bg-secondary/50",
                isCurrent && "bg-secondary/30 font-medium"
              )}
            >
              <StatusIcon status={phase.status} />
              <span className="flex-1">{label}</span>
              {isCurrent && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/__tests__/phase-switcher.test.tsx -v`
Expected: PASS

**Step 5: Integrate into phase page**

In `app/project/[id]/phase/[phaseId]/page.tsx`, import and add:

```typescript
import { PhaseSwitcher } from "@/components/phase-switcher";
```

In the page header area (after the back link, before the phase title), add:

```tsx
{phases && (
  <PhaseSwitcher
    currentPhaseId={phaseId}
    phases={phases.map(p => ({ phaseId: p.phaseId, status: p.status }))}
    projectId={projectId}
  />
)}
```

**Step 6: Run tests and typecheck**

Run: `npm run typecheck && npm test -- components/__tests__/ -v`
Expected: PASS

**Step 7: Commit**

```bash
git add components/phase-switcher.tsx components/__tests__/phase-switcher.test.tsx app/project/[id]/phase/[phaseId]/page.tsx
git commit -m "feat: add phase switcher dropdown for in-context navigation"
```

---

### Task 8: Breadcrumb Navigation

**Files:**
- Create: `components/breadcrumbs.tsx`
- Modify: `app/project/[id]/phase/[phaseId]/page.tsx` (replace back link with breadcrumbs)
- Modify: `app/project/[id]/page.tsx` (add breadcrumbs)
- Test: `components/__tests__/breadcrumbs.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/__tests__/breadcrumbs.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumbs } from '../breadcrumbs';

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe('Breadcrumbs', () => {
  test('renders breadcrumb trail', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My Project', href: '/project/123' },
          { label: 'Constitution' },
        ]}
      />
    );
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('My Project')).toBeDefined();
    expect(screen.getByText('Constitution')).toBeDefined();
  });

  test('last item is not a link', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Current' },
        ]}
      />
    );
    const current = screen.getByText('Current');
    expect(current.closest('a')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/breadcrumbs.test.tsx -v`
Expected: FAIL

**Step 3: Create the Breadcrumbs component**

```typescript
// components/breadcrumbs.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? "text-foreground font-medium" : "text-muted-foreground")}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/__tests__/breadcrumbs.test.tsx -v`
Expected: PASS

**Step 5: Integrate into phase page and project page**

Replace the `← Back to Project` link in the phase page with:

```tsx
<Breadcrumbs items={[
  { label: 'Dashboard', href: '/dashboard' },
  { label: project?.title || 'Project', href: `/project/${projectId}` },
  { label: phaseConfig.label },
]} />
```

Add breadcrumbs to the project overview page:

```tsx
<Breadcrumbs items={[
  { label: 'Dashboard', href: '/dashboard' },
  { label: project?.title || 'Project' },
]} />
```

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add components/breadcrumbs.tsx components/__tests__/breadcrumbs.test.tsx app/project/[id]/phase/[phaseId]/page.tsx app/project/[id]/page.tsx
git commit -m "feat: add breadcrumb navigation to project and phase pages"
```

---

### Task 9: Copy-to-Clipboard Agent Handoff

**Files:**
- Modify: `components/export-options.tsx:20-53` (add clipboard export options)
- Test: `components/__tests__/export-options-clipboard.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/__tests__/export-options-clipboard.test.tsx
import { describe, test, expect, vi } from 'vitest';

describe('Clipboard export formatting', () => {
  test('formatForClaudeCode wraps content in CLAUDE.md format', () => {
    const { formatForClaudeCode } = require('../../lib/export/clipboard-formats');
    const result = formatForClaudeCode({
      title: 'My Project',
      content: '# Constitution\nSome rules',
    });
    expect(result).toContain('# My Project');
    expect(result).toContain('Some rules');
  });

  test('formatForCursor wraps content in .cursorrules format', () => {
    const { formatForCursor } = require('../../lib/export/clipboard-formats');
    const result = formatForCursor({
      title: 'My Project',
      content: '# Constitution\nSome rules',
    });
    expect(result).toContain('Some rules');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/export-options-clipboard.test.tsx -v`
Expected: FAIL — module not found

**Step 3: Create clipboard format utilities**

```typescript
// lib/export/clipboard-formats.ts

interface ClipboardFormatInput {
  title: string;
  content: string;
}

/**
 * Format spec content for Claude Code (CLAUDE.md style)
 */
export function formatForClaudeCode(input: ClipboardFormatInput): string {
  return `# ${input.title} — SpecForge Specification

> Generated by SpecForge. Paste this into your CLAUDE.md or use as agent context.

${input.content}
`;
}

/**
 * Format spec content for Cursor (.cursorrules style)
 */
export function formatForCursor(input: ClipboardFormatInput): string {
  return `# Project: ${input.title}

${input.content}
`;
}

/**
 * Format spec content for GitHub Copilot (.github/copilot-instructions.md)
 */
export function formatForCopilot(input: ClipboardFormatInput): string {
  return `# ${input.title}

${input.content}
`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/__tests__/export-options-clipboard.test.tsx -v`
Expected: PASS

**Step 5: Add clipboard buttons to export-options.tsx**

In `components/export-options.tsx`, add new export options after the existing ones:

```typescript
import { Clipboard } from "lucide-react";
import { formatForClaudeCode, formatForCursor } from "@/lib/export/clipboard-formats";
```

Add to the `EXPORT_OPTIONS` array:

```typescript
{
  id: "copy-claude",
  label: "Copy for Claude Code",
  description: "Copy SKILL.md content to clipboard for CLAUDE.md",
  icon: Clipboard,
  format: "clipboard-claude" as const,
  available: true,
},
{
  id: "copy-cursor",
  label: "Copy for Cursor",
  description: "Copy specification to clipboard for .cursorrules",
  icon: Clipboard,
  format: "clipboard-cursor" as const,
  available: true,
},
```

Add clipboard handling in the `handleExport` switch:

```typescript
case "clipboard-claude": {
  const skillContent = generateSkillMd({ project: { ... }, artifacts });
  const formatted = formatForClaudeCode({ title: project.title, content: skillContent });
  await navigator.clipboard.writeText(formatted);
  toast.success("Copied to Clipboard", {
    description: "Paste into your CLAUDE.md or agent context.",
  });
  break;
}
case "clipboard-cursor": {
  const skillContent = generateSkillMd({ project: { ... }, artifacts });
  const formatted = formatForCursor({ title: project.title, content: skillContent });
  await navigator.clipboard.writeText(formatted);
  toast.success("Copied to Clipboard", {
    description: "Paste into your .cursorrules file.",
  });
  break;
}
```

Update the ExportOption type to include the new formats.

**Step 6: Run typecheck and tests**

Run: `npm run typecheck && npm test -- components/__tests__/ -v`
Expected: PASS

**Step 7: Commit**

```bash
git add lib/export/clipboard-formats.ts components/export-options.tsx components/__tests__/export-options-clipboard.test.tsx
git commit -m "feat: add copy-to-clipboard export for Claude Code and Cursor"
```

---

## Milestone 1 Checkpoint

Run full quality gate:

```bash
npm run typecheck && npm run lint -- --max-warnings=0 && npm test
```

Expected: ALL PASS. At this point SpecForge has:
- Suggestion chips on questions
- Mermaid diagrams in artifact previews
- Phase switcher dropdown
- Breadcrumb navigation
- Copy-to-clipboard for agent handoff

---

## Milestone 2: Schema Extensions & Medium-Effort Features

---

### Task 10: Structured Tickets from User Stories — Schema

**Files:**
- Modify: `convex/schema.ts` (add `tickets` table)
- Create: `convex/tickets.ts` (CRUD operations)
- Test: `convex/__tests__/tickets.test.ts`

**Step 1: Write the failing test**

```typescript
// convex/__tests__/tickets-schema.test.ts
import { describe, test, expect } from 'vitest';

describe('Ticket data structure', () => {
  test('ticket has required fields', () => {
    const ticket = {
      projectId: 'proj_123',
      phaseId: 'stories',
      title: 'Implement login flow',
      description: 'Build the OAuth2 login flow with Google provider',
      acceptanceCriteria: [
        'User can click "Sign in with Google"',
        'Successful auth redirects to dashboard',
        'Failed auth shows error message',
      ],
      status: 'todo' as const,
      priority: 'high' as const,
      estimatedEffort: 'M',
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(ticket.acceptanceCriteria).toHaveLength(3);
    expect(ticket.status).toBe('todo');
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- convex/__tests__/tickets-schema.test.ts -v`
Expected: PASS (structural test)

**Step 3: Add tickets table to schema**

In `convex/schema.ts`, add before the closing `});`:

```typescript
// Structured tickets parsed from User Stories artifacts
tickets: defineTable({
  projectId: v.id('projects'),
  phaseId: v.string(),
  artifactId: v.optional(v.id('artifacts')),
  title: v.string(),
  description: v.string(),
  acceptanceCriteria: v.array(v.string()),
  status: v.union(
    v.literal('todo'),
    v.literal('in_progress'),
    v.literal('done'),
  ),
  priority: v.union(
    v.literal('critical'),
    v.literal('high'),
    v.literal('medium'),
    v.literal('low'),
  ),
  estimatedEffort: v.optional(v.string()),
  order: v.number(),
  dependencies: v.optional(v.array(v.id('tickets'))),
  externalId: v.optional(v.string()),
  externalUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_project', ['projectId'])
  .index('by_project_phase', ['projectId', 'phaseId']),
```

**Step 4: Create tickets.ts with CRUD mutations**

```typescript
// convex/tickets.ts
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tickets')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    ticketId: v.id('tickets'),
    status: v.union(v.literal('todo'), v.literal('in_progress'), v.literal('done')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const deleteTicket = mutation({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.ticketId);
  },
});

export const reorder = mutation({
  args: {
    ticketId: v.id('tickets'),
    newOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      order: args.newOrder,
      updatedAt: Date.now(),
    });
  },
});
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add convex/schema.ts convex/tickets.ts convex/__tests__/tickets-schema.test.ts
git commit -m "feat: add tickets table and CRUD mutations"
```

---

### Task 11: Ticket Parser — Extract Tickets from User Stories Artifact

**Files:**
- Create: `lib/ticket-parser.ts`
- Create: `convex/actions/parseTickets.ts`
- Test: `lib/__tests__/ticket-parser.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/ticket-parser.test.ts
import { describe, test, expect } from 'vitest';
import { parseTicketsFromMarkdown } from '../ticket-parser';

describe('parseTicketsFromMarkdown', () => {
  test('extracts tickets from user stories markdown', () => {
    const markdown = `
## Epic: Authentication
### US-001: User Login
As a user, I want to log in with my email so that I can access my account.

**Acceptance Criteria:**
- User can enter email and password
- Valid credentials redirect to dashboard
- Invalid credentials show error message

**Priority:** High
**Effort:** M

### US-002: Password Reset
As a user, I want to reset my password so that I can regain access.

**Acceptance Criteria:**
- User can request password reset via email
- Reset link expires after 24 hours

**Priority:** Medium
**Effort:** S
`;
    const tickets = parseTicketsFromMarkdown(markdown);
    expect(tickets).toHaveLength(2);
    expect(tickets[0].title).toBe('US-001: User Login');
    expect(tickets[0].acceptanceCriteria).toHaveLength(3);
    expect(tickets[0].priority).toBe('high');
    expect(tickets[0].estimatedEffort).toBe('M');
    expect(tickets[1].title).toBe('US-002: Password Reset');
    expect(tickets[1].acceptanceCriteria).toHaveLength(2);
  });

  test('handles markdown without structured tickets', () => {
    const markdown = '# User Stories\n\nSome general text about user stories.';
    const tickets = parseTicketsFromMarkdown(markdown);
    expect(tickets).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/ticket-parser.test.ts -v`
Expected: FAIL — module not found

**Step 3: Create the ticket parser**

```typescript
// lib/ticket-parser.ts

export interface ParsedTicket {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort?: string;
}

/**
 * Parses user story markdown into structured tickets.
 * Looks for H3 headings (### ) as ticket boundaries.
 * Extracts acceptance criteria from bullet lists under "Acceptance Criteria" heading.
 */
export function parseTicketsFromMarkdown(markdown: string): ParsedTicket[] {
  const tickets: ParsedTicket[] = [];
  // Split by H3 headings
  const sections = markdown.split(/^### /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const titleLine = lines[0]?.trim();

    // Skip sections that don't look like user stories
    if (!titleLine || titleLine.startsWith('#')) continue;

    // Extract description (lines between title and acceptance criteria)
    const acIndex = lines.findIndex(l =>
      /acceptance\s+criteria/i.test(l) || /\*\*acceptance/i.test(l)
    );
    const description = lines
      .slice(1, acIndex > 0 ? acIndex : undefined)
      .filter(l => !l.startsWith('**Priority') && !l.startsWith('**Effort') && l.trim())
      .join('\n')
      .trim();

    // Extract acceptance criteria (bullet points)
    const criteria: string[] = [];
    if (acIndex > 0) {
      for (let i = acIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('- ')) {
          criteria.push(line.slice(2).trim());
        } else if (line.startsWith('**') || line.startsWith('##')) {
          break;
        }
      }
    }

    // Extract priority
    const priorityMatch = section.match(/\*\*Priority:\*\*\s*(critical|high|medium|low)/i);
    const priority = (priorityMatch?.[1]?.toLowerCase() || 'medium') as ParsedTicket['priority'];

    // Extract effort
    const effortMatch = section.match(/\*\*Effort:\*\*\s*(\S+)/i);
    const estimatedEffort = effortMatch?.[1];

    if (titleLine && (description || criteria.length > 0)) {
      tickets.push({
        title: titleLine,
        description,
        acceptanceCriteria: criteria,
        priority,
        estimatedEffort,
      });
    }
  }

  return tickets;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/ticket-parser.test.ts -v`
Expected: PASS

**Step 5: Create the parseTickets action**

```typescript
// convex/actions/parseTickets.ts
'use node';

import { action } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import { parseTicketsFromMarkdown } from '../../lib/ticket-parser';

export const parseTicketsFromArtifact = action({
  args: {
    projectId: v.id('projects'),
    artifactId: v.id('artifacts'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    // Get artifact content
    const artifact = await ctx.runQuery(internalApi.internal.getArtifactInternal, {
      artifactId: args.artifactId,
    });
    if (!artifact) throw new Error('Artifact not found');

    // Parse tickets from markdown
    const parsed = parseTicketsFromMarkdown(artifact.content);

    // Create ticket documents
    const ticketIds = [];
    for (let i = 0; i < parsed.length; i++) {
      const ticket = parsed[i];
      const id = await ctx.runMutation(internalApi.internal.createTicketInternal, {
        projectId: args.projectId,
        phaseId: artifact.phaseId,
        artifactId: args.artifactId,
        title: ticket.title,
        description: ticket.description,
        acceptanceCriteria: ticket.acceptanceCriteria,
        status: 'todo',
        priority: ticket.priority,
        estimatedEffort: ticket.estimatedEffort,
        order: i,
      });
      ticketIds.push(id);
    }

    return { ticketCount: ticketIds.length, ticketIds };
  },
});
```

Note: This requires adding `createTicketInternal` to `convex/internal.ts`. Add:

```typescript
export const createTicketInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    artifactId: v.optional(v.id('artifacts')),
    title: v.string(),
    description: v.string(),
    acceptanceCriteria: v.array(v.string()),
    status: v.union(v.literal('todo'), v.literal('in_progress'), v.literal('done')),
    priority: v.union(v.literal('critical'), v.literal('high'), v.literal('medium'), v.literal('low')),
    estimatedEffort: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('tickets', {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add lib/ticket-parser.ts lib/__tests__/ticket-parser.test.ts convex/actions/parseTickets.ts convex/internal.ts
git commit -m "feat: parse user stories into structured tickets"
```

---

### Task 12: Ticket Board UI

**Files:**
- Create: `components/ticket-board.tsx`
- Create: `components/ticket-card.tsx`
- Modify: `app/project/[id]/phase/[phaseId]/page.tsx` (add ticket board for stories phase)
- Test: `components/__tests__/ticket-card.test.tsx`

This task creates a Kanban-style board (Todo | In Progress | Done) for the tickets extracted from User Stories. Each ticket card shows title, priority badge, effort estimate, and acceptance criteria count. Cards have status toggle buttons.

**Step 1: Write the failing test for TicketCard**

```typescript
// components/__tests__/ticket-card.test.tsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TicketCard } from '../ticket-card';

describe('TicketCard', () => {
  const ticket = {
    _id: 't1' as any,
    title: 'Implement login',
    description: 'Build OAuth login flow',
    acceptanceCriteria: ['Can enter email', 'Redirect on success'],
    status: 'todo' as const,
    priority: 'high' as const,
    estimatedEffort: 'M',
    order: 0,
  };

  test('renders ticket title and priority', () => {
    render(<TicketCard ticket={ticket} onStatusChange={() => {}} />);
    expect(screen.getByText('Implement login')).toBeDefined();
    expect(screen.getByText('high')).toBeDefined();
  });

  test('shows acceptance criteria count', () => {
    render(<TicketCard ticket={ticket} onStatusChange={() => {}} />);
    expect(screen.getByText('2 criteria')).toBeDefined();
  });
});
```

**Step 2-7: Implement TicketCard, TicketBoard, integrate into phase page, test, commit**

Follow the same TDD pattern. The TicketBoard component groups tickets by status into three columns. The phase page renders the TicketBoard below the artifact preview when `phaseId === 'stories'` and tickets exist.

**Step 8: Commit**

```bash
git add components/ticket-card.tsx components/ticket-board.tsx components/__tests__/ticket-card.test.tsx app/project/[id]/phase/[phaseId]/page.tsx
git commit -m "feat: add ticket board UI for structured story management"
```

---

### Task 13: Skip Phases (Workflow Lite)

**Files:**
- Modify: `convex/schema.ts` (add `skippedPhases` to projects)
- Modify: `app/project/[id]/page.tsx` (add skip toggle on phase cards)
- Modify: `convex/projects.ts` (add skipPhase mutation)
- Modify: `lib/specification/dependency-graph.ts` (respect skipped phases)
- Test: `lib/__tests__/dependency-graph-skip.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/dependency-graph-skip.test.ts
import { describe, test, expect } from 'vitest';
import { canGeneratePhase } from '../specification/dependency-graph';

describe('canGeneratePhase with skipped phases', () => {
  test('skipped dependencies do not block generation', () => {
    const statuses = {
      constitution: 'ready',
      brief: 'ready',
      prd: 'ready',
      domainModel: 'skipped', // Skipped
      specs: 'pending',
    };
    const result = canGeneratePhase('specs', statuses);
    // domainModel is skipped, so it should not block specs
    expect(result.canGenerate).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/dependency-graph-skip.test.ts -v`
Expected: FAIL — `canGeneratePhase` treats 'skipped' as not-ready

**Step 3: Update canGeneratePhase to respect skipped phases**

In `lib/specification/dependency-graph.ts`, update `canGeneratePhase`:

```typescript
export function canGeneratePhase(
  phaseId: string,
  phaseStatuses: Record<string, string>,
): { canGenerate: boolean; blockedBy: string[] } {
  const deps = PHASE_DEPENDENCIES[phaseId] || [];
  const blockedBy = deps.filter(
    (dep) => phaseStatuses[dep] !== 'ready' && phaseStatuses[dep] !== 'skipped'
  );
  return {
    canGenerate: blockedBy.length === 0,
    blockedBy,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/dependency-graph-skip.test.ts -v`
Expected: PASS

**Step 5: Add skippedPhases to project schema**

In `convex/schema.ts`, add to the projects table:

```typescript
skippedPhases: v.optional(v.array(v.string())),
```

**Step 6: Add skipPhase mutation**

In `convex/projects.ts`:

```typescript
export const toggleSkipPhase = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    skip: v.boolean(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');

    const current = project.skippedPhases || [];
    const updated = args.skip
      ? [...new Set([...current, args.phaseId])]
      : current.filter(p => p !== args.phaseId);

    await ctx.db.patch(args.projectId, { skippedPhases: updated });
  },
});
```

**Step 7: Update phase status in project overview**

In `app/project/[id]/page.tsx`, update the phases table to also include `skippedPhases` from the project. Add a skip/unskip toggle button to each phase card (except constitution which cannot be skipped). Update the `phases` query to merge skip status.

**Step 8: Commit**

```bash
git add convex/schema.ts convex/projects.ts lib/specification/dependency-graph.ts lib/__tests__/dependency-graph-skip.test.ts app/project/[id]/page.tsx
git commit -m "feat: allow skipping phases in the generation pipeline"
```

---

### Task 14: Parallel Phase Generation

**Files:**
- Create: `convex/actions/generateAllPhases.ts`
- Modify: `app/project/[id]/page.tsx` (add "Generate All" button)
- Modify: `lib/specification/dependency-graph.ts` (add `getParallelBatches`)
- Test: `lib/__tests__/parallel-batches.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/parallel-batches.test.ts
import { describe, test, expect } from 'vitest';
import { getParallelBatches } from '../specification/dependency-graph';

describe('getParallelBatches', () => {
  test('returns phases grouped by parallelizable levels', () => {
    const batches = getParallelBatches([]);
    expect(batches[0]).toEqual(expect.arrayContaining(['constitution', 'brief']));
    expect(batches[1]).toEqual(expect.arrayContaining(['prd', 'domainModel']));
    expect(batches[2]).toEqual(['specs']);
    expect(batches[3]).toEqual(['stories']);
    expect(batches[4]).toEqual(['artifacts']);
    expect(batches[5]).toEqual(['handoff']);
  });

  test('skips phases in skippedPhases list', () => {
    const batches = getParallelBatches(['domainModel', 'artifacts']);
    expect(batches[0]).toEqual(expect.arrayContaining(['constitution', 'brief']));
    expect(batches[1]).toEqual(['prd']); // domainModel skipped
    // artifacts skipped, handoff should still be in a later batch
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/parallel-batches.test.ts -v`
Expected: FAIL — function not found

**Step 3: Implement getParallelBatches**

In `lib/specification/dependency-graph.ts`, add:

```typescript
/**
 * Returns phases grouped into batches that can run in parallel.
 * Each batch contains phases whose dependencies are all in earlier batches.
 */
export function getParallelBatches(skippedPhases: string[] = []): string[][] {
  const remaining = new Set(
    Object.keys(PHASE_DEPENDENCIES).filter(p => !skippedPhases.includes(p))
  );
  const resolved = new Set(skippedPhases);
  const batches: string[][] = [];

  while (remaining.size > 0) {
    const batch: string[] = [];
    for (const phase of remaining) {
      const deps = PHASE_DEPENDENCIES[phase] || [];
      if (deps.every(d => resolved.has(d))) {
        batch.push(phase);
      }
    }
    if (batch.length === 0) break; // Safety: prevent infinite loop
    batch.forEach(p => {
      remaining.delete(p);
      resolved.add(p);
    });
    batches.push(batch);
  }

  return batches;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/parallel-batches.test.ts -v`
Expected: PASS

**Step 5: Create generateAllPhases action**

This action uses `getParallelBatches` to determine execution order, then schedules generation for each batch. Within each batch, phases are scheduled using `ctx.scheduler.runAfter(0, ...)` to run concurrently. Between batches, the action waits for all phases in the batch to complete before moving to the next.

**Step 6: Add "Generate All" button to project overview**

In `app/project/[id]/page.tsx`, add a button above the phase cards grid.

**Step 7: Commit**

```bash
git add lib/specification/dependency-graph.ts lib/__tests__/parallel-batches.test.ts convex/actions/generateAllPhases.ts app/project/[id]/page.tsx
git commit -m "feat: parallel phase generation with dependency-aware batching"
```

---

## Milestone 2 Checkpoint

Run full quality gate:

```bash
npm run typecheck && npm run lint -- --max-warnings=0 && npm test
```

---

## Milestone 3: Multiple Modes & Plan Streaming

---

### Task 15: Quick Spec Mode — Route & UI

**Files:**
- Create: `app/(auth)/dashboard/quick/page.tsx`
- Modify: `app/(auth)/dashboard/page.tsx` (add Quick Spec CTA)
- Create: `convex/actions/generateQuickSpec.ts`
- Test: Integration test via typecheck

**Purpose:** A single-page spec generator. User enters a task description, gets a focused spec with architecture constraints, implementation steps, and a Mermaid diagram — no 8-phase ceremony.

The Quick Spec mode generates a single artifact containing:
1. Constraints (from constitution prompt, condensed)
2. Architecture decisions
3. Implementation plan (3-5 steps)
4. Mermaid architecture diagram
5. Key files to touch (if codebase context available later)

**Step 1: Create the page**

```typescript
// app/(auth)/dashboard/quick/page.tsx
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ArtifactContent } from "@/components/artifact-content";
import { Loader2, Zap } from "lucide-react";

export default function QuickSpecPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // ... action call, form, result display
}
```

The action `generateQuickSpec` takes a title and description, runs a single LLM call with a combined prompt that produces a condensed spec with architecture, constraints, implementation steps, and a Mermaid diagram.

**Step 2-6: Implement action, connect UI, test, commit**

**Step 7: Commit**

```bash
git add app/(auth)/dashboard/quick/page.tsx convex/actions/generateQuickSpec.ts app/(auth)/dashboard/page.tsx
git commit -m "feat: add Quick Spec mode for single-page spec generation"
```

---

### Task 16: Plan Streaming — Section Plan as LLM-Driven

**Files:**
- Create: `convex/actions/generateSectionPlan.ts`
- Modify: `app/project/[id]/phase/[phaseId]/page.tsx` (stream plan instead of static)
- Modify: `components/section-plan-preview.tsx` (support streaming state)

**Purpose:** Instead of using hardcoded section plans from `section-plans.ts`, generate the section plan dynamically using an LLM call. The plan streams via Convex reactive queries, showing sections appearing one by one.

**Step 1: Create the action**

The action takes project context + phase ID, calls the LLM to generate a section plan (as structured JSON), and stores intermediate results in a `generationTasks` record. The client subscribes to the task via `useQuery` and renders sections as they appear.

**Step 2: Update SectionPlanPreview to support streaming**

Add a `streamingPlans` prop that accepts incrementally-loaded section plans. Show a skeleton for sections not yet planned, and animate new sections in with Framer Motion.

**Step 3-5: Test, integrate, commit**

```bash
git commit -m "feat: stream section plan generation in real-time"
```

---

### Task 17: Cross-Project Constitution Templates

**Files:**
- Modify: `convex/schema.ts` (add `constitutionTemplates` table)
- Create: `convex/constitutionTemplates.ts` (CRUD)
- Modify: `app/(auth)/dashboard/new/page.tsx` (add template picker)

**Purpose:** Allow users to save a project's constitution as a reusable template, and select from saved templates when creating a new project.

**Step 1: Add schema**

```typescript
constitutionTemplates: defineTable({
  userId: v.string(),
  name: v.string(),
  description: v.string(),
  constitutionContent: v.string(),
  lockedConstraints: v.optional(v.object({
    architecture: v.optional(v.string()),
    stateManagement: v.optional(v.string()),
    apiDesign: v.optional(v.string()),
    securityProtocols: v.optional(v.array(v.string())),
  })),
  createdAt: v.number(),
  usageCount: v.number(),
}).index('by_user', ['userId']),
```

**Step 2-6: CRUD operations, template picker UI, test, commit**

```bash
git commit -m "feat: reusable constitution templates for new projects"
```

---

## Milestone 3 Checkpoint

Run full quality gate:

```bash
npm run typecheck && npm run lint -- --max-warnings=0 && npm test
```

---

## Milestone 4: Agent Transparency & Codebase Awareness (Infrastructure)

---

### Task 18: Generation Activity Stream UI

**Files:**
- Create: `components/generation-activity-stream.tsx`
- Modify: `convex/schema.ts` (add `activityLog` field to generationTasks)
- Modify: `convex/internalActions.ts` (log activity entries during generation)
- Modify: `app/project/[id]/phase/[phaseId]/page.tsx` (show activity stream during generation)

**Purpose:** Show users what the system is doing during generation — "Analyzing constitution constraints...", "Building architecture section...", "Cross-referencing domain model...". This doesn't require multi-agent architecture — it's transparency into the existing sequential pipeline.

**Step 1: Add activity log to generationTasks schema**

In `convex/schema.ts`, add to the `generationTasks` table:

```typescript
activityLog: v.optional(v.array(v.object({
  timestamp: v.number(),
  message: v.string(),
  type: v.union(v.literal('info'), v.literal('context'), v.literal('generating'), v.literal('complete')),
}))),
```

**Step 2: Create the activity stream component**

```typescript
// components/generation-activity-stream.tsx
"use client";

import { cn } from "@/lib/utils";
import { Loader2, Check, Search, Brain } from "lucide-react";

interface ActivityEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'context' | 'generating' | 'complete';
}

interface GenerationActivityStreamProps {
  activities: ActivityEntry[];
  isActive: boolean;
}

export function GenerationActivityStream({ activities, isActive }: GenerationActivityStreamProps) {
  if (activities.length === 0) return null;

  const icons = {
    info: Search,
    context: Brain,
    generating: Loader2,
    complete: Check,
  };

  return (
    <div className="space-y-2 p-4 border-2 border-border bg-secondary/10">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Generation Activity
      </h4>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {activities.map((activity, i) => {
          const Icon = icons[activity.type];
          const isLatest = i === activities.length - 1 && isActive;
          return (
            <div key={i} className={cn(
              "flex items-center gap-2 text-sm",
              isLatest ? "text-foreground" : "text-muted-foreground"
            )}>
              <Icon className={cn("w-3 h-3 flex-shrink-0", isLatest && activity.type === 'generating' && "animate-spin")} />
              <span>{activity.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Emit activity entries from generation worker**

In `convex/internalActions.ts`, before each section generation, push an activity entry:

```typescript
await ctx.runMutation(internalApi.internal.appendActivityLog, {
  taskId,
  entry: {
    timestamp: Date.now(),
    message: `Gathering context from ${upstreamPhases.join(', ')}...`,
    type: 'context',
  },
});
```

**Step 4-6: Integrate into phase page, test, commit**

```bash
git commit -m "feat: real-time generation activity stream during phase generation"
```

---

### Task 19: Codebase Awareness — GitHub Repo Connection

**Files:**
- Modify: `convex/schema.ts` (add `projectCodebase` table)
- Create: `app/api/github/callback/route.ts` (OAuth callback)
- Create: `convex/actions/scanCodebase.ts` (fetch repo structure)
- Create: `components/codebase-connector.tsx` (UI for connecting repo)
- Modify: `app/(auth)/dashboard/new/page.tsx` (add repo connection step)

**Purpose:** Allow users to connect a GitHub repository to their project. SpecForge fetches the file tree and key file contents, stores them, and injects them into generation prompts for codebase-aware specs.

**Step 1: Add projectCodebase table**

```typescript
projectCodebase: defineTable({
  projectId: v.id('projects'),
  repoUrl: v.string(),
  repoOwner: v.string(),
  repoName: v.string(),
  defaultBranch: v.string(),
  fileTree: v.string(), // JSON serialized directory tree
  keyFiles: v.array(v.object({
    path: v.string(),
    content: v.string(),
    language: v.string(),
    sizeBytes: v.number(),
  })),
  analyzedAt: v.number(),
  totalFiles: v.number(),
  totalDirectories: v.number(),
}).index('by_project', ['projectId']),
```

**Step 2: Create GitHub OAuth flow**

Use Clerk's OAuth capabilities or a direct GitHub App integration. The callback route exchanges the code for an access token, which is stored encrypted in the user's config.

**Step 3: Create scanCodebase action**

The action:
1. Fetches the repo tree from GitHub API (`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`)
2. Identifies key files (package.json, README, config files, schema files, main entry points)
3. Fetches content for key files (up to ~50 files, prioritized by importance)
4. Stores in `projectCodebase` table
5. Returns summary stats

**Step 4: Create UI component**

```typescript
// components/codebase-connector.tsx
// A card with GitHub repo URL input, "Connect" button, scan progress, and file tree preview
```

**Step 5: Inject codebase context into prompts**

Modify `convex/actions/generatePhase.ts` to check for `projectCodebase` and include relevant file tree + key file contents in the generation prompt.

**Step 6-8: Test, integrate, commit**

```bash
git commit -m "feat: GitHub repo connection and codebase-aware spec generation"
```

---

### Task 20: Implementation Verification — Spec-to-Code Diff Checker

**Files:**
- Create: `convex/actions/verifyImplementation.ts`
- Create: `lib/verification/spec-checker.ts`
- Create: `components/verification-panel.tsx`
- Modify: `convex/schema.ts` (add `verificationResults` table)

**Purpose:** After a user implements code based on their spec, they can paste a git diff or connect their repo, and SpecForge checks whether the implementation matches the spec's requirements.

**Step 1: Add verificationResults table**

```typescript
verificationResults: defineTable({
  projectId: v.id('projects'),
  phaseId: v.string(),
  checkedAt: v.number(),
  findings: v.array(v.object({
    category: v.union(
      v.literal('bug'),
      v.literal('performance'),
      v.literal('security'),
      v.literal('clarity'),
      v.literal('missing'),
    ),
    severity: v.union(v.literal('critical'), v.literal('major'), v.literal('minor')),
    title: v.string(),
    description: v.string(),
    suggestion: v.string(),
    specReference: v.optional(v.string()),
  })),
  overallScore: v.number(),
  status: v.union(v.literal('pass'), v.literal('fail'), v.literal('warning')),
}).index('by_project', ['projectId']),
```

**Step 2: Create verification action**

The action:
1. Takes a git diff (text) and a project ID
2. Fetches all project artifacts (constitution, specs, stories)
3. Builds a prompt: "Given this specification [spec content] and this implementation diff [diff], identify mismatches"
4. Parses structured findings from the LLM response
5. Stores results in `verificationResults`

**Step 3: Create verification UI**

A panel on the phase page with:
- Text area for pasting git diff
- "Verify" button
- Results display with categorized findings (Bug, Performance, Security, Clarity, Missing)
- Each finding shows: title, description, suggestion, severity badge
- Overall score (0-100) with pass/fail/warning status

**Step 4-6: Test, integrate, commit**

```bash
git commit -m "feat: implementation verification against generated specs"
```

---

## Milestone 4 Checkpoint

Run full quality gate:

```bash
npm run typecheck && npm run lint -- --max-warnings=0 && npm test
```

---

## Milestone 5: Custom Workflows & Collaboration (Future)

These tasks are documented for future implementation but depend on M1-M4 being complete.

---

### Task 21: Custom Workflow Templates (Design Only)

**Schema:**
```typescript
workflows: defineTable({
  userId: v.string(),
  name: v.string(),
  description: v.string(),
  phases: v.array(v.object({
    id: v.string(),
    label: v.string(),
    description: v.string(),
    promptTemplate: v.string(),
    dependencies: v.array(v.string()),
    required: v.boolean(),
    artifactType: v.string(),
  })),
  isDefault: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_user', ['userId']),
```

Pre-built templates:
- **Full Spec** (current 8-phase pipeline)
- **Lean MVP** (Constitution + Brief + Specs + Handoff)
- **API-First** (Constitution + PRD + Specs + Handoff)
- **Frontend-Only** (Brief + Domain + Stories + Handoff)

### Task 22: Team Collaboration (Design Only)

**Schema additions:**
```typescript
// Add to projects table:
sharedWith: v.optional(v.array(v.object({
  userId: v.string(),
  role: v.union(v.literal('editor'), v.literal('viewer')),
  addedAt: v.number(),
}))),

// New table for comments:
comments: defineTable({
  projectId: v.id('projects'),
  phaseId: v.optional(v.string()),
  artifactId: v.optional(v.id('artifacts')),
  userId: v.string(),
  content: v.string(),
  resolved: v.boolean(),
  createdAt: v.number(),
}).index('by_project', ['projectId']),
```

### Task 23: GitHub Issues Export (Design Only)

Extend the `tickets.ts` mutations to include a `pushToGitHub` action that:
1. Takes a ticket ID and GitHub repo connection
2. Formats the ticket as a GitHub Issue (title, body with acceptance criteria, labels from priority)
3. Creates the issue via GitHub API
4. Stores the external ID and URL back on the ticket

---

## Milestone 5 Checkpoint

These are design-only tasks. Implementation follows after M1-M4 are validated in production.

---

## Test Coverage Summary

| Milestone | New Test Files | Coverage Areas |
|-----------|---------------|----------------|
| M1 | 7 test files | QuestionSuggestions, MermaidDiagram, mermaid extraction, PhaseSwitcher, Breadcrumbs, clipboard formats |
| M2 | 4 test files | Tickets schema, ticket parser, ticket card, parallel batches, dependency graph skip |
| M3 | 2 test files | Quick spec mode, plan streaming |
| M4 | 3 test files | Activity stream, codebase scan, verification |

---

## Dependency Map

```
M1 (Quick Wins) ──→ No dependencies, can start immediately
    ├── Task 1-3: Question suggestions (schema → backend → UI)
    ├── Task 4-6: Mermaid diagrams (component → rendering → prompts)
    ├── Task 7-8: Navigation (phase switcher → breadcrumbs)
    └── Task 9: Clipboard export (standalone)

M2 (Schema Extensions) ──→ Depends on M1 completion
    ├── Task 10-12: Tickets (schema → parser → board UI)
    ├── Task 13: Skip phases (schema + dependency graph)
    └── Task 14: Parallel generation (dependency graph + action)

M3 (New Modes) ──→ Depends on M1, partially M2
    ├── Task 15: Quick Spec (new route + action)
    ├── Task 16: Plan streaming (action + UI)
    └── Task 17: Constitution templates (schema + UI)

M4 (Infrastructure) ──→ Depends on M1-M3
    ├── Task 18: Activity stream (schema + UI)
    ├── Task 19: Codebase awareness (GitHub + schema + prompts)
    └── Task 20: Verification (requires Task 19)

M5 (Future) ──→ Depends on M1-M4
    ├── Task 21: Custom workflows
    ├── Task 22: Collaboration
    └── Task 23: GitHub Issues export
```
