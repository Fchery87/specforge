# Phase Stepper Status Design

## Goal
Surface phase status in the project overview stepper with minimal visual noise while keeping the stepper compact and scannable.

## Recommended Approach
Enhance the existing `PhaseStepper` to accept optional status metadata per phase and render inline status badges for non-pending states. The stepper remains a compact navigation element with subtle status accents.

## UX Decisions
- **Badges:** Show `ready`, `generating`, and `error` badges inline to the right of the phase label. Omit `pending` badges to reduce clutter.
- **Accents:** Apply a subtle border tint on non-current steps based on status (success/warning/destructive).
- **Active state:** Preserve the existing active styling; status accents should not override the active state.

## Data Flow
- `app/project/[id]/page.tsx` already queries `getProjectPhases` and builds a `phaseStatusMap`.
- Pass `phaseStatuses` as a prop to `PhaseStepper`.
- `PhaseStepper` maps each phase id to a status (defaulting to `pending`).

## Components
- `components/phase-stepper.tsx`
  - New optional prop: `phaseStatuses?: Record<string, "pending" | "generating" | "ready" | "error">`
  - Inline `StatusBadge` for non-pending statuses.
  - Optional border accent for non-current steps based on status.
- `app/project/[id]/page.tsx`
  - Pass `phaseStatuses={Object.fromEntries(phaseStatusMap)}`.

## Testing
- Add a UI test ensuring `ready` and `error` badges render while `pending` does not.

