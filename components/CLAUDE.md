# components/ CLAUDE.md

**Technology**: React 19, Next.js 16 (App Router), Tailwind CSS, Radix UI, Framer Motion
**Parent Context**: Extends [../CLAUDE.md](../CLAUDE.md)

## Development Commands

```bash
# Lint components
npm run lint -- components/

# Run component tests
npm test -- components/__tests__/

# Typecheck components
npm run typecheck 2>&1 | grep -i component || true
```

## Architecture

### Directory Structure
```
components/
├── *.tsx                 # Page-level or complex components
├── ui/                   # Design system primitives
│   ├── button.tsx        # CVA pattern reference
│   ├── dialog.tsx        # Radix dialog
│   ├── confirm-dialog.tsx
│   └── motion.tsx        # Framer Motion wrappers
├── __tests__/            # Component tests
└── __tests__/batch-ai-modal.test.tsx
```

### Code Organization Patterns

#### Components
- **DO**: Functional components with hooks
  - Example: `components/ui/button.tsx`
  - Pattern: One component per file
  - Co-locate tests: `components/__tests__/*.test.tsx`

- **DON'T**: Class components (React functional only)

#### Styling
- **DO**: Tailwind utility classes + CVA variants
  - Example: `components/ui/button.tsx` (CVA pattern)
- **DON'T**: Hardcode colors - use Tailwind theme
- **DON'T**: Inline styles (except rare dynamic values)

#### Animations
- **DO**: Use Framer Motion via `components/ui/motion.tsx`
  - Example: `motion.div` wrappers for transitions
- **DO**: Use `AnimatePresence` for exit animations

#### State Management
- **DO**: Use local `useState`/`useReducer` for component state
- **DO**: Use React Context for shared UI state (theme, toasts)

#### Icons
- **DO**: Use `lucide-react`
  - Import: `import { X, Plus } from "lucide-react"`

#### Toasts
- **DO**: Use sonner via `lib/notifications.ts`
  - Pattern: `toast.success("Message")` or `showToast()`

### Client vs Server Components
- **Server**: Default in Next.js 13+
- **Client**: Add `"use client"` for:
  - Hook usage (`useState`, `useEffect`, custom hooks)
  - Event handlers (`onClick`, `onChange`)
  - Browser APIs (`localStorage`, `window`)

## Key Files

### Core Patterns
- `components/ui/button.tsx` - CVA variants pattern
- `components/ui/dialog.tsx` - Radix Dialog pattern
- `components/ui/confirm-dialog.tsx` - Confirmation dialog pattern
- `components/ui/motion.tsx` - Framer Motion utilities
- `lib/notifications.ts` - Toast notification patterns
- `lib/utils.ts` - `cn()` utility for class merging

### Main Components
- `components/questions-panel.tsx` - Complex state pattern
- `components/batch-ai-modal.tsx` - Modal with async operations
- `components/phase-status.tsx` - Progress display

### Layout
- `app/layout.tsx` - Root layout with providers
- `components/site-header.tsx` - Navigation
- `components/site-footer.tsx` - Footer

## Quick Search Commands

```bash
# Find components
rg -n "export (function|const) .*=" components/

# Find UI components
rg -n "export" components/ui/

# Find 'use client' directives
rg -n "'use client'" components/

# Find test files
find components -name "*.test.tsx"

# Find Radix usage
rg -n "@radix-ui/react-" components/

# Find Framer Motion
rg -n "motion\." components/
```

## Common Gotchas

- **'use client'**: Required at top of file for hooks and event handlers
- **Radix imports**: Must import from `@radix-ui/react-*`
- **CVA variants**: Define variants for all prop-based styles
- **Tailwind**: Design system uses `rounded-none` (sharp corners)
- **cn() utility**: Always use for merging tailwind classes

## Pre-PR Checklist

```bash
npm run lint -- components/ --max-warnings=0
npm test -- components/__tests__/
```
