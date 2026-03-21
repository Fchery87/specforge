# SpecForge Frontend UI - Architectural Implementation Plan

## Executive Summary

**Current State:** SpecForge has a strong visual identity (brutalist, acid-yellow on black) and functional 8-phase specification workflow. However, the frontend has critical reliability gaps, type safety erosion, accessibility violations, and core UX friction points.

**Goal:** Transform the frontend into a production-grade, accessible, and maintainable application while preserving the unique visual design.

**Timeline:** 4-week phased implementation
**Risk Level:** Medium (requires careful regression testing)

---

## Phase 1: Reliability & Safety (Week 1)

**Priority:** P0 - Critical  
**Objective:** Eliminate crash scenarios and silent failures

### 1.1 Error Boundaries & Error Pages

**Files to Create:**
```
app/
├── error.tsx                    # Global error boundary
├── not-found.tsx               # Branded 404 page
├── project/
│   └── [id]/
│       ├── not-found.tsx       # Invalid project ID
│       └── error.tsx           # Project-specific errors
└── (auth)/
    └── dashboard/
        └── loading.tsx         # Suspense boundary
```

**Implementation Pattern:**

```typescript
// app/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-[15vw] font-bold uppercase tracking-tighter text-muted-foreground/20 leading-none">
        ERROR
      </div>
      <h1 className="text-v-h2 mt-8">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-center">
        We&apos;ve encountered an unexpected error. Please try again or contact support.
      </p>
      <Button onClick={reset} className="mt-6">
        Try Again
      </Button>
    </div>
  );
}
```

```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-[20vw] font-bold uppercase tracking-tighter text-muted-foreground/20 leading-none">
        404
      </div>
      <h1 className="text-v-h2 mt-8">Page Not Found</h1>
      <p className="text-muted-foreground mt-2">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/dashboard">
        <Button className="mt-6">Return to Dashboard</Button>
      </Link>
    </div>
  );
}
```

```typescript
// app/project/[id]/page.tsx - Fix loading state
// Line 58 - Replace infinite skeleton with not-found state

if (project === null) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-[15vw] font-bold uppercase tracking-tighter text-muted-foreground/20">
        NOT FOUND
      </div>
      <h1 className="text-v-h2 mt-8">Project Not Found</h1>
      <p className="text-muted-foreground mt-2">
        The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
      </p>
      <Link href="/dashboard">
        <Button className="mt-6">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Throwing an error anywhere in the app shows branded error page with retry
- [ ] Invalid project IDs show project not-found state
- [ ] Dashboard has proper loading skeleton matching layout
- [ ] All error pages match brutalist visual identity

---

### 1.2 Error Feedback Implementation

**Files to Modify:**
- `app/(auth)/dashboard/new/page.tsx`
- `app/(auth)/dashboard/page.tsx`

**Implementation Pattern:**

```typescript
// app/(auth)/dashboard/new/page.tsx:52
} catch (error) {
  toast.error("Failed to create project", {
    description: error instanceof Error ? error.message : "Please try again or check your connection.",
    duration: 5000,
  });
  setIsCreating(false);
}
```

```typescript
// app/(auth)/dashboard/page.tsx:83
const handleDeleteProject = async (projectId: string) => {
  try {
    setDeletingProjectId(projectId);
    await deleteProject({ projectId });
    toast.success("Project deleted successfully");
  } catch (error) {
    toast.error("Failed to delete project", {
      description: "Please try again. The project may have active generations.",
    });
  } finally {
    setDeletingProjectId(null);
  }
};
```

**Acceptance Criteria:**
- [ ] All async operations have try/catch with toast notifications
- [ ] Error messages are user-friendly (not raw error objects)
- [ ] Loading states properly managed during error scenarios

---

### 1.3 Type Safety Foundation

**Files to Create:**
```
lib/
└── convex-actions.ts    # Typed action exports
```

**Implementation Pattern:**

```typescript
// lib/convex-actions.ts
import { api } from "@/convex/_generated/api";

// Export typed action references
export const generatePhaseAction = api.actions.generatePhase.generatePhase;
export const generateAllPhasesAction = api.actions.generateAllPhases.generateAllPhases;
export const deleteProjectAction = api.projects.deleteProject;
export const createProjectAction = api.projects.createProject;

// Add more as needed - this eliminates "as any" casts
```

**Files to Update:**
Replace all `(api as any)["actions/generatePhase"]` patterns with direct imports.

**Example Migration:**
```typescript
// Before:
const generatePhaseAction = (api as any)["actions/generatePhase"]?.generatePhase as any;

// After:
import { generatePhaseAction } from "@/lib/convex-actions";
const generatePhase = useAction(generatePhaseAction);
```

**Acceptance Criteria:**
- [ ] Zero "as any" casts remain on Convex API references
- [ ] All actions imported from lib/convex-actions.ts
- [ ] TypeScript strict mode passes without errors

---

## Phase 2: Foundation & Architecture (Week 2)

**Priority:** P1 - Significant UX  
**Objective:** Component modularity and code organization

### 2.1 Extract Shared Constants

**Files to Create:**
```
lib/
├── phase-config.ts      # Consolidated phase configuration
└── clerk-theme.ts       # Clerk appearance constants
```

**Implementation:**

```typescript
// lib/phase-config.ts
import { FileText, Lightbulb, BookOpen, Code, Settings, Shield, FileCheck, Rocket } from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface PhaseConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  shortLabel: string;
}

export const PHASES: readonly PhaseConfig[] = [
  {
    id: "constitution",
    label: "Constitution",
    shortLabel: "Constitution",
    icon: FileText,
    description: "Define the core vision, goals, and constraints of your project",
  },
  {
    id: "context",
    label: "Context & Research",
    shortLabel: "Context",
    icon: Lightbulb,
    description: "Gather context, research, and background information",
  },
  {
    id: "specifications",
    label: "Specifications",
    shortLabel: "Specs",
    icon: BookOpen,
    description: "Define detailed technical specifications",
  },
  {
    id: "architecture",
    label: "Architecture",
    shortLabel: "Architecture",
    icon: Code,
    description: "Design system architecture and component structure",
  },
  {
    id: "implementation",
    label: "Implementation",
    shortLabel: "Implementation",
    icon: Settings,
    description: "Plan implementation details and development workflow",
  },
  {
    id: "testing",
    label: "Testing Strategy",
    shortLabel: "Testing",
    icon: Shield,
    description: "Define testing approach and quality assurance",
  },
  {
    id: "deployment",
    label: "Deployment",
    shortLabel: "Deployment",
    icon: FileCheck,
    description: "Plan deployment strategy and infrastructure",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    shortLabel: "Maintenance",
    icon: Rocket,
    description: "Define ongoing maintenance and support plans",
  },
] as const;

export const PHASE_CONFIG: Record<string, PhaseConfig> = Object.fromEntries(
  PHASES.map((p) => [p.id, p])
);

export function getPhaseById(id: string): PhaseConfig | undefined {
  return PHASE_CONFIG[id];
}

export function getPhaseIndex(id: string): number {
  return PHASES.findIndex((p) => p.id === id);
}
```

```typescript
// lib/clerk-theme.ts
import { Appearance } from "@clerk/types";

// Extracted from site-header.tsx to eliminate duplication
export const clerkUserButtonAppearance: Appearance = {
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorText: "hsl(var(--foreground))",
    colorBackground: "hsl(var(--background))",
    colorTextSecondary: "hsl(var(--muted-foreground))",
    colorInputBackground: "hsl(var(--card))",
    colorInputText: "hsl(var(--foreground))",
  },
  elements: {
    userButtonAvatarBox: "w-8 h-8",
    userButtonPopoverCard: "bg-card border border-border",
    userPreviewMainIdentifier: "font-semibold",
    userButtonPopoverFooter: "hidden",
  },
};
```

**Files to Update:**
- `app/project/[id]/page.tsx` - Replace local PHASES with import
- `app/project/[id]/phase/[phaseId]/page.tsx` - Replace local PHASE_CONFIG with import
- `components/site-header.tsx` - Use clerkUserButtonAppearance constant

---

### 2.2 Phase Page Component Refactoring

**Current State:** `app/project/[id]/phase/[phaseId]/page.tsx` is 543 lines managing 15+ state variables

**Files to Create:**
```
app/project/[id]/phase/[phaseId]/
├── page.tsx                    # Reduced to orchestration layer (~150 lines)
├── components/
│   ├── PhaseHeader.tsx         # Breadcrumbs, icon, title
│   ├── PhaseContent.tsx        # Main content area with tabs
│   ├── PhaseArtifactsColumn.tsx # Right column with streaming preview
│   └── SectionPlanPreview.tsx  # Section plan display component
└── hooks/
    └── usePhaseGeneration.ts   # All generation state management
```

**Implementation Pattern:**

```typescript
// hooks/usePhaseGeneration.ts
"use client";

import { useState, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { generatePhaseAction } from "@/lib/convex-actions";

interface UsePhaseGenerationProps {
  projectId: string;
  phaseId: string;
}

interface UsePhaseGenerationReturn {
  isPhaseStarting: boolean;
  phaseTaskId: string | null;
  generationTask: any; // Replace with proper type
  handleStartGeneration: () => Promise<void>;
  handleConfirmSectionPlan: () => Promise<void>;
}

export function usePhaseGeneration({
  projectId,
  phaseId,
}: UsePhaseGenerationProps): UsePhaseGenerationReturn {
  const [isPhaseStarting, setIsPhaseStarting] = useState(false);
  const [phaseTaskId, setPhaseTaskId] = useState<string | null>(null);

  const generatePhase = useAction(generatePhaseAction);
  const generationTask = useQuery(
    api.tasks.get,
    phaseTaskId ? { taskId: phaseTaskId } : "skip"
  );

  const handleStartGeneration = useCallback(async () => {
    try {
      setIsPhaseStarting(true);
      const result = await generatePhase({
        projectId,
        phaseId,
      });
      setPhaseTaskId(result.taskId);
      toast.success("Generation started");
    } catch (error) {
      toast.error("Failed to start generation");
      console.error(error);
    } finally {
      setIsPhaseStarting(false);
    }
  }, [projectId, phaseId, generatePhase]);

  const handleConfirmSectionPlan = useCallback(async () => {
    // Implementation
  }, []);

  return {
    isPhaseStarting,
    phaseTaskId,
    generationTask,
    handleStartGeneration,
    handleConfirmSectionPlan,
  };
}
```

```typescript
// components/PhaseHeader.tsx
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PHASE_CONFIG } from "@/lib/phase-config";

interface PhaseHeaderProps {
  projectId: string;
  projectTitle: string;
  phaseId: string;
}

export function PhaseHeader({ projectId, projectTitle, phaseId }: PhaseHeaderProps) {
  const phase = PHASE_CONFIG[phaseId];
  const PhaseIcon = phase?.icon;

  return (
    <div className="space-y-2">
      <Link
        href={`/project/${projectId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Project
      </Link>

      <div className="flex items-center gap-3">
        {PhaseIcon && (
          <div className="p-2 rounded-lg bg-primary/10">
            <PhaseIcon className="w-6 h-6 text-primary" />
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">{projectTitle}</p>
          <h1 className="text-v-h1">{phase?.label}</h1>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Phase page reduced to <200 lines
- [ ] Each component has single responsibility
- [ ] Custom hook encapsulates all generation logic
- [ ] No regression in functionality

---

### 2.3 Mobile Layout Improvements

**Files to Modify:**
- `app/project/[id]/phase/[phaseId]/page.tsx`

**Implementation:**

```typescript
// Add Tabs component for mobile layout
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// In the component return:
<div className="lg:hidden">
  <Tabs defaultValue="questions" className="w-full">
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="questions">Questions</TabsTrigger>
      <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
    </TabsList>
    <TabsContent value="questions">
      <QuestionsPanel ... />
    </TabsContent>
    <TabsContent value="artifacts">
      <PhaseArtifactsColumn ... />
    </TabsContent>
  </Tabs>
</div>

<div className="hidden lg:grid lg:grid-cols-2 gap-6">
  {/* Existing 2-column layout */}
</div>
```

---

### 2.4 Add Confirmation Dialogs

**Files to Modify:**
- `app/project/[id]/page.tsx` - Generate All Phases button

**Implementation:**

```typescript
// Add to app/project/[id]/page.tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// State for confirmation dialog
const [showGenerateAllConfirm, setShowGenerateAllConfirm] = useState(false);

// In the JSX:
<Button
  onClick={() => setShowGenerateAllConfirm(true)}
  disabled={isGeneratingAll}
>
  {isGeneratingAll ? (
    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
  ) : (
    <Zap className="w-4 h-4 mr-2" />
  )}
  Generate All Phases
</Button>

<ConfirmDialog
  open={showGenerateAllConfirm}
  onOpenChange={setShowGenerateAllConfirm}
  title="Generate All Phases"
  description="This will generate all pending phases using AI. This may take several minutes and consume API credits. Are you sure you want to continue?"
  confirmLabel="Generate All"
  confirmVariant="default"
  onConfirm={() => {
    setShowGenerateAllConfirm(false);
    handleGenerateAll();
  }}
/>
```

---

## Phase 3: Polish & Accessibility (Week 3)

**Priority:** P2 - Accessibility & Visual Consistency  
**Objective:** WCAG 2.1 AA compliance and visual systematization

### 3.1 Accessibility Improvements

**Files to Create/Modify:**
```
app/
├── layout.tsx                  # Add skip-to-content link
└── project/
    └── [id]/
        └── phase/
            └── [phaseId]/
                └── components/
                    └── questions-panel.tsx  # Add proper labels
```

**Implementation Pattern:**

```typescript
// app/layout.tsx - Add skip-to-content
<body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:top-4 focus:left-4 rounded-md"
  >
    Skip to main content
  </a>
  <div id="main-content" className="relative flex min-h-screen flex-col">
    <SiteHeader />
    <main className="flex-1">{children}</main>
  </div>
</body>
```

```typescript
// components/questions-panel.tsx - Add proper labels
// Line 397-401 - Add label association
<div className="space-y-2">
  <label
    htmlFor={`answer-${question.id}`}
    className="sr-only"
  >
    Answer for question {idx + 1}: {question.text}
  </label>
  <Textarea
    id={`answer-${question.id}`}
    value={answers[question.id] || ""}
    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
    placeholder="Enter your answer..."
    className="min-h-[100px]"
  />
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>{answers[question.id]?.length || 0} characters</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleAISuggest(question.id)}
      disabled={isSuggesting}
      aria-label={`Get AI suggestion for question ${idx + 1}`}
    >
      {isSuggesting ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <Sparkles className="w-3 h-3 mr-1" />
      )}
      Suggest
    </Button>
  </div>
</div>
```

**Acceptance Criteria:**
- [ ] All interactive elements have accessible names
- [ ] All form inputs have associated labels
- [ ] Skip-to-content link works on all pages
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text)

---

### 3.2 Visual Consistency

**Files to Modify:**
- `components/ui/card.tsx` - Add title variants
- Create `components/ui/decorative-text.tsx`

**Implementation:**

```typescript
// components/ui/decorative-text.tsx
import { cn } from "@/lib/utils";

interface DecorativeTextProps {
  text: string;
  className?: string;
  variant?: "hero" | "section" | "background";
}

export function DecorativeText({
  text,
  className,
  variant = "background",
}: DecorativeTextProps) {
  const variants = {
    hero: "text-[15vw] md:text-[12vw]",
    section: "text-[12vw] md:text-[8vw]",
    background: "text-[20vw] absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3",
  };

  return (
    <div
      className={cn(
        "font-bold uppercase tracking-tighter text-muted-foreground/10 leading-none pointer-events-none select-none",
        variants[variant],
        className
      )}
    >
      {text}
    </div>
  );
}
```

```typescript
// components/ui/card.tsx - Add title variants
import { cva, type VariantProps } from "class-variance-authority";

const cardTitleVariants = cva(
  "font-semibold leading-none tracking-tight",
  {
    variants: {
      variant: {
        default: "text-2xl md:text-3xl font-bold uppercase tracking-tighter",
        project: "text-lg tracking-normal font-semibold",
        section: "text-xl tracking-normal font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof cardTitleVariants> {}

const CardTitle = React.forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className, variant, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(cardTitleVariants({ variant }), className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";
```

---

### 3.3 State Management Improvements

**Files to Modify:**
- `components/questions-panel.tsx` - Add optimistic updates

**Implementation:**

```typescript
// Add unsaved changes tracking
const [unsavedQuestions, setUnsavedQuestions] = useState<Set<string>>(new Set());
const [isDirty, setIsDirty] = useState(false);

// Update handleAnswerChange
const handleAnswerChange = (questionId: string, value: string) => {
  setAnswers((prev) => ({ ...prev, [questionId]: value }));
  setUnsavedQuestions((prev) => new Set(prev).add(questionId));
  setIsDirty(true);
};

// Add beforeunload warning
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty || pendingSaveRef.current.size > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isDirty]);

// Show unsaved indicator in UI
{isDirty && (
  <div className="flex items-center gap-2 text-xs text-amber-500">
    <AlertCircle className="w-3 h-3" />
    Unsaved changes
  </div>
)}
```

---

## Phase 4: Experience & Scale (Week 4)

**Priority:** P3 - Onboarding & Architecture  
**Objective:** New user experience and code quality

### 4.1 Onboarding Improvements

**Files to Create/Modify:**
```
app/(auth)/dashboard/
├── page.tsx                    # Add onboarding banner
└── components/
    └── OnboardingBanner.tsx    # First-time user guidance
```

**Implementation:**

```typescript
// app/(auth)/dashboard/components/OnboardingBanner.tsx
"use client";

import { useState } from "react";
import { X, Sparkles, FileText, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OnboardingBanner() {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("onboarding-dismissed") === "true";
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("onboarding-dismissed", "true");
  };

  if (isDismissed) return null;

  return (
    <Alert className="mb-6 relative">
      <Rocket className="h-4 w-4" />
      <AlertTitle>Welcome to SpecForge!</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          SpecForge helps you create comprehensive software specifications using AI.
          Your project will go through 8 phases from initial concept to deployment planning.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>Start with a Constitution</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span>Answer AI-generated questions</span>
          </div>
        </div>
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={handleDismiss}
      >
        <X className="w-4 h-4" />
      </Button>
    </Alert>
  );
}
```

```typescript
// Add LLM configuration check in dashboard
const llmProviders = useQuery(api.llmProviders.list);
const hasConfiguredProvider = llmProviders && llmProviders.length > 0;

{!hasConfiguredProvider && (
  <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
    <AlertTriangle className="h-4 w-4 text-amber-500" />
    <AlertTitle>Configure Your AI Provider</AlertTitle>
    <AlertDescription className="mt-2">
      You need to configure an LLM provider (OpenAI, Anthropic, etc.) before you can generate specifications.
      <Button variant="link" asChild className="px-0 ml-2">
        <Link href="/settings">Go to Settings</Link>
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

### 4.2 Utility Extraction

**Files to Create:**
```
lib/
└── hooks/
    └── useDebounce.ts
```

**Implementation:**

```typescript
// lib/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Files to Update:**
- `components/questions-panel.tsx` - Replace inline useDebounce with import
- `components/model-selector.tsx` - Replace inline debounce logic

---

## Technical Specifications

### Code Patterns

**1. Component Structure:**
```typescript
// Pattern: Co-located components with clear exports
├── page.tsx                    # Page orchestration
├── components/
│   ├── index.ts               # Barrel exports
│   ├── FeatureName.tsx        # Main component
│   ├── FeatureName.test.tsx   # Co-located tests
│   └── FeatureName.types.ts   # Shared types (if complex)
└── hooks/
    ├── useFeatureName.ts      # Custom hook
    └── useFeatureName.test.ts # Hook tests
```

**2. Type Safety Pattern:**
```typescript
// Always use generated Convex types
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

// Use Doc<"tableName"> for document types
interface ProjectCardProps {
  project: Doc<"projects">;
}

// Use api.* for action references
const deleteProject = useMutation(api.projects.deleteProject);
```

**3. Error Handling Pattern:**
```typescript
// Standard async handler pattern
try {
  setIsLoading(true);
  await asyncOperation();
  toast.success("Success message");
} catch (error) {
  toast.error("User-friendly error", {
    description: error instanceof Error ? error.message : "Try again",
  });
  console.error("Detailed error:", error);
} finally {
  setIsLoading(false);
}
```

### Testing Strategy

**Unit Tests:**
- Test utility functions in `lib/`
- Test hooks with `@testing-library/react-hooks`
- Test component rendering and interactions

**Integration Tests:**
- Test page-level interactions
- Test data flow from Convex to UI
- Test error boundary behavior

**Accessibility Tests:**
- Use jest-axe for automated a11y checks
- Manual keyboard navigation testing
- Screen reader testing (NVDA/VoiceOver)

### Dependencies

**New Dependencies:**
- `zod` - Runtime type validation (optional, for form validation)
- `react-hook-form` - Form state management (optional)

**No New Dependencies Required for:**
- Error boundaries (Next.js built-in)
- Toast notifications (already using sonner)
- Debouncing (custom hook)

### Performance Considerations

**1. Memoization:**
```typescript
// Use useMemo for expensive computations
const filteredPhases = useMemo(() => {
  return phases.filter((p) => p.status === "completed");
}, [phases]);

// Use useCallback for event handlers passed to children
const handleDelete = useCallback((id: string) => {
  deleteProject({ projectId: id });
}, [deleteProject]);
```

**2. Code Splitting:**
- Phase components are already lazy-loaded via Next.js
- Consider dynamic imports for heavy components

### Migration Strategy

**Phase 1:** No breaking changes, purely additive
**Phase 2:** Refactoring with parallel implementations
**Phase 3:** Accessibility fixes, no visual changes
**Phase 4:** UX improvements, backward compatible

**Rollback Plan:**
- Each phase is independently revertible
- Feature flags for major UI changes (if needed)
- Git tags at each phase completion

---

## Success Metrics

### Code Quality
- [ ] Zero P0 issues resolved
- [ ] TypeScript strict mode passes
- [ ] ESLint with --max-warnings=0 passes
- [ ] 80%+ test coverage for new utilities

### Accessibility
- [ ] Lighthouse accessibility score ≥ 95
- [ ] axe-core automated tests pass
- [ ] Manual keyboard navigation works
- [ ] Screen reader labels present on all interactive elements

### Performance
- [ ] No regression in Core Web Vitals
- [ ] Phase page bundle size reduced by 30%
- [ ] Error recovery time < 2 seconds

### User Experience
- [ ] Zero silent failures (all errors show toast)
- [ ] Mobile phase navigation usable
- [ ] First-time user sees onboarding
- [ ] No infinite loading states

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Component refactoring introduces bugs | High | Comprehensive test coverage before refactor; feature flags |
| Type safety changes break existing code | Medium | Incremental migration; keep old patterns until new ones verified |
| Accessibility changes affect visual design | Low | Use sr-only classes; maintain existing visual hierarchy |
| Mobile layout changes confuse existing users | Low | A/B test if needed; clear visual indicators |

---

## Appendix

### File Change Summary

**New Files (18):**
```
app/error.tsx
app/not-found.tsx
app/project/[id]/not-found.tsx
app/project/[id]/error.tsx
app/(auth)/dashboard/loading.tsx
app/(auth)/dashboard/components/OnboardingBanner.tsx
app/project/[id]/phase/[phaseId]/components/PhaseHeader.tsx
app/project/[id]/phase/[phaseId]/components/PhaseContent.tsx
app/project/[id]/phase/[phaseId]/components/PhaseArtifactsColumn.tsx
app/project/[id]/phase/[phaseId]/components/SectionPlanPreview.tsx
app/project/[id]/phase/[phaseId]/hooks/usePhaseGeneration.ts
lib/convex-actions.ts
lib/phase-config.ts
lib/clerk-theme.ts
lib/hooks/useDebounce.ts
components/ui/decorative-text.tsx
```

**Modified Files (8):**
```
app/layout.tsx
app/(auth)/dashboard/page.tsx
app/(auth)/dashboard/new/page.tsx
app/project/[id]/page.tsx
app/project/[id]/phase/[phaseId]/page.tsx
components/site-header.tsx
components/ui/card.tsx
components/questions-panel.tsx
```

**Deleted Files (0):**
(None - all changes are additive or refactor existing code)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-21  
**Author:** AI Code Assistant  
**Reviewers:** Engineering Team
