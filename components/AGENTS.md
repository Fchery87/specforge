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
// ✅ DO: Import motion directly, and only where a transition earns its place
import { motion, AnimatePresence } from "motion/react";
// See: components/prompt-enhance-button.tsx
```
Animations are rare by design. Reduced motion collapses every duration to zero at the token level,
so a component inherits the decision rather than re-implementing it.

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
- **Workflow data**: `lib/workflow.ts` owns the phases, stages, mode policies, labels and `nextAction`
- **Evidence Review**: `components/evidence-review-panel.tsx` (requirement status and source review)
- **Verification**: `components/verification-panel.tsx` (diff findings with requirement references)
- **Schema Validator**: `components/schema-validator-panel.tsx` (Monaco-style JSON/YAML validator)
- **Stress-Test Interview**: `components/stress-test-modal.tsx` (Interactive grilling modal)
- **Ticket Board**: `components/ticket-board.tsx`, `components/ticket-card.tsx` (Tracer bullets & blocking edges)
- **Admin Navigation**: `components/admin/admin-nav.tsx`
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
- **Tailwind**: Radius has three values only: `rounded-sm` (10px controls), `rounded-lg` (16px containers), `rounded-full` (pills)
- **Colour**: Use a token utility. Never a raw hex, an `rgba()`, or a `bg-zinc-*`. See [docs/design.md](../docs/design.md)
- **Type**: Three roles. `font-display` (Funnel Display) for headings, `font-sans` (Funnel Sans) for interface and specification prose, `font-mono` (Red Hat Mono) for IDs and code. Headings get Funnel Display from the base styles, so do not set `font-sans` on a heading. Headings are sentence case, never uppercase
- **Colour names**: Hue tokens are named for meaning: `brand`, `success`, `warning`, `destructive`, `info`. The Ember names (`ember`, `sage`, `brick`, `amber`, `slate`) are deleted
- **Press, not hover**: `Button` scales to 0.97 on press. Nothing moves on hover
- **Focus**: The global `:focus-visible` outline is the only focus treatment. Do not add `ring-*` focus styles
- **The document language**: A specification renders through `components/spec-document.tsx` and `components/artifact-document.tsx`, not as cards
- **One description per page**: The workflow is described once per job. `StageStepper` is the map (a band, segments from `stage-band.tsx`), `NextActionPanel` or `NextActionButton` states the next step, `PhaseLedger` lists every phase on the project page, `ProjectNav` lists every phase beside a phase page, and `AddSectionMenu` re-enables a skipped phase. Read a phase's status through `phaseState` in `lib/workflow.ts`, never a local lookup
- **Sheets**: A working surface sits on `rounded-lg border border-line bg-surface`. Claim IDs render as hallmarks (`hallmark`, `hallmark-struck`, `hallmark-review`, `hallmark-missing`)
- **Document anchors**: A heading's id is derived from the heading's own text and applied only when `parseSpecOutline` produced the same id. A document therefore renders correctly in pieces, with no positional cursor. Do not reintroduce one: the cursor that existed drifted whenever the outline and the renderer disagreed about what counted as a heading, which misdirected the table of contents

## Pre-PR Checks

```bash
npm run lint -- components/ --max-warnings=0
node design/lint-tokens.mjs $(find components -name '*.tsx')
```

CI lints the whole tree, so a new component is covered as soon as it lands.

## Design system reference

[docs/design.md](../docs/design.md) holds the palette, the type scale, the motion and focus rules,
the document language, and the audit commands. [ADR 0001](../docs/adr/0001-ember-design-system.md)
records the structural system, and [ADR 0002](../docs/adr/0002-magenta-brand.md) records the Magenta
palette and type that replaced Ember's.
