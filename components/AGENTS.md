# components/ AGENTS.md

## Package Identity

React UI components for the SpecForge frontend. Built with Next.js 16, Tailwind CSS, Radix UI primitives, and Framer Motion animations.

## Setup & Run

No separate install - components are part of the main Next.js app.

```bash
# Dev server (from root)
npm run dev

# Lint components
npm run lint -- components/
```

## Patterns & Conventions

### File Organization
- **Top-level components**: `components/*.tsx` (page-level or complex components)
- **Design system**: `components/ui/*.tsx` (reusable UI primitives)
- **Tests**: `components/__tests__/*.test.tsx`

### Naming Conventions
- Components: PascalCase (e.g., `SiteHeader.tsx`, `QuestionsPanel.tsx`)
- Test files: `*.test.tsx` co-located or in `__tests__` folder
- UI components: Follow Radix patterns with variants using CVA

### Preferred Patterns

**1. Functional Components with CVA variants:**
```tsx
// ✅ DO: Use cva for button variants
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// See: components/ui/button.tsx
```

**2. Radix UI Dialogs/Sheets:**
```tsx
// ✅ DO: Follow confirm-dialog.tsx pattern
import * as Dialog from "@radix-ui/react-dialog";
// See: components/ui/confirm-dialog.tsx
```

**3. Framer Motion animations:**
```tsx
// ✅ DO: Use motion.tsx utilities
import { motion } from "motion/react";
// See: components/ui/motion.tsx
```

**4. Client components with state:**
```tsx
// ✅ DO: Mark with 'use client' directive
"use client";
import { useState } from "react";
// See: components/questions-panel.tsx
```

**5. Toast notifications:**
```tsx
// ✅ DO: Use sonner via lib/notifications.ts
import { toast } from "sonner";
import { showToast } from "@/lib/notifications";
// See: lib/notifications.ts
```

**6. Icons:**
```tsx
// ✅ DO: Use lucide-react
import { X, Plus, ChevronDown } from "lucide-react";
```

### ❌ DON'T
- ❌ Use class components (React functional components only)
- ❌ Hardcode colors - use Tailwind theme or CSS variables
- ❌ Import directly from `node_modules` - use `@/` alias
- ❌ Create components without `cn()` utility for class merging

## Touch Points / Key Files

- **Button variants**: `components/ui/button.tsx` (CVA pattern reference)
- **Dialogs**: `components/ui/dialog.tsx`, `components/ui/confirm-dialog.tsx`
- **The reading surface**: `components/artifact-document.tsx` renders an artifact as a document; `components/spec-document.tsx` holds the notation
- **Artifact view**: `components/artifact-preview.tsx` (header with identity and actions, body is the document)
- **Artifact Editor**: `components/artifact-editor-modal.tsx` (Split, Edit, Preview, and Schema modes)
- **Workflow**: `components/stage-stepper.tsx` (the map), `components/next-action-button.tsx` (the instruction), `components/add-section-menu.tsx` (re-enable a skipped phase)
- **Evidence Review**: `components/evidence-review-panel.tsx` (requirement status and source review)
- **Verification**: `components/verification-panel.tsx` (diff findings with requirement references)
- **Schema Validator**: `components/schema-validator-panel.tsx` (Monaco-style JSON/YAML validator)
- **Stress-Test Interview**: `components/stress-test-modal.tsx` (Interactive grilling modal)
- **Ticket Board**: `components/ticket-board.tsx`, `components/ticket-card.tsx` (Tracer bullets & blocking edges)
- **Admin Navigation**: `components/admin/admin-nav.tsx`
- **Animation**: `components/ui/motion.tsx`
- **Notifications**: `lib/notifications.ts`
- **Class utility**: `lib/utils.ts` (cn function)
- **Main layout**: `app/layout.tsx`
- **Page with components**: `app/page.tsx`

## JIT Index Hints

```bash
# Find React components
rg -n "export function|export const.*=" components/

# Find UI components
rg -n "export" components/ui/

# Find test files
find components -name "*.test.tsx"

# Find 'use client' components
rg -n "'use client'" components/
```

## Common Gotchas

- **'use client'**: Any component using hooks, event handlers, or browser APIs must have this directive at the top
- **Radix imports**: Must import from `@radix-ui/react-*` packages (already installed)
- **Motion**: Wrap with `AnimatePresence` for exit animations
- **Tailwind**: Radius has three values only: `rounded-sm` (6px controls), `rounded-lg` (12px containers), `rounded-full` (pills)
- **Colour**: Use a token utility. Never a raw hex, an `rgba()`, or a `bg-zinc-*`. See [docs/design.md](../docs/design.md)
- **Type**: Three roles. `font-sans` for chrome, `font-serif` for specification prose, `font-mono` for IDs and code. Headings are sentence case, never uppercase
- **Focus**: The global `:focus-visible` outline is the only focus treatment. Do not add `ring-*` focus styles
- **The document language**: A specification renders through `components/spec-document.tsx` and `components/artifact-document.tsx`, not as cards
- **One description per page**: The workflow is described once. `StageStepper` maps it, `NextActionButton` states the next step, `AddSectionMenu` re-enables a skipped phase. `StageCard` and `StageTabs` are retained but no page renders them; do not add a fourth description of the same eight phases
- **Mermaid**: A document rendered in pieces must advance the heading cursor with `countSpecHeadings`, or its anchors drift from `parseSpecOutline`

## Pre-PR Checks

```bash
npm run lint -- components/ --max-warnings=0
node design/lint-tokens.mjs $(find components -name '*.tsx')
```

CI lints the whole tree, so a new component is covered as soon as it lands.

## Design system reference

[docs/design.md](../docs/design.md) holds the palette, the type scale, the motion and focus rules,
the document language, and the audit commands. [ADR 0001](../docs/adr/0001-ember-design-system.md)
records why the previous brutalist system was replaced.
