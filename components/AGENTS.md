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
import { motion } from "framer-motion";
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
- **Tailwind**: Use `rounded-none` (design system uses sharp corners)

## Pre-PR Checks

```bash
npm run lint -- components/ --max-warnings=0
```
