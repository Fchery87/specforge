# AI-Generated Questions and Phase Timeout Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate project-specific questions for every phase via LLM (with safe fallback) and harden phase generation to avoid timeouts or stuck statuses.

**Architecture:** Add an AI question-generation path in `convex/actions/generateQuestions.ts` that uses project title/description and phase context, bounded by phase-specific min/max counts. On failure or timeout, fall back to existing template questions. For phase generation, add error handling so phase status moves to `error` on failure, reduce sequential LLM calls, and ensure relevant questions map to sections.

**Tech Stack:** Convex actions, React client, LLM provider layer, TypeScript.

---

### Task 1: Document current question flow and add tests for AI question generation fallback

**Files:**
- Modify: `convex/actions/generateQuestions.ts`
- Create: `convex/actions/__tests__/generateQuestions.test.ts` (if tests exist)

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { buildQuestionPrompt, normalizeQuestions } from "../generateQuestions";

describe("generateQuestions", () => {
  it("normalizes AI questions and enforces min/max", () => {
    const raw = [
      { text: "Q1" },
      { text: "Q2" },
      { text: "Q3" },
      { text: "Q4" },
      { text: "Q5" },
      { text: "Q6" },
      { text: "Q7" },
      { text: "Q8" },
      { text: "Q9" },
    ];

    const result = normalizeQuestions(raw, "brief", { min: 5, max: 8 });
    expect(result.length).toBe(8);
    expect(result[0].text).toBe("Q1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: FAIL with “buildQuestionPrompt is not exported” or missing functions.

**Step 3: Write minimal implementation**

```ts
// in convex/actions/generateQuestions.ts
export function normalizeQuestions(
  questions: Array<{ text: string; required?: boolean }>,
  phaseId: string,
  range: { min: number; max: number }
) {
  const sliced = questions.slice(0, range.max);
  while (sliced.length < range.min) {
    sliced.push({ text: "" });
  }
  return sliced.filter((q) => q.text.trim().length > 0);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generateQuestions.ts convex/actions/__tests__/generateQuestions.test.ts
git commit -m "test: add normalization tests for ai question generation"
```

---

### Task 2: Add AI question generation with fallback to templates

**Files:**
- Modify: `convex/actions/generateQuestions.ts`
- Modify: `lib/llm/response-normalizer.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { buildQuestionPrompt } from "../generateQuestions";

describe("buildQuestionPrompt", () => {
  it("includes project title, description, phase, and range", () => {
    const prompt = buildQuestionPrompt({
      title: "My App",
      description: "A tool",
      phaseId: "specs",
      range: { min: 5, max: 8 },
    });

    expect(prompt).toContain("My App");
    expect(prompt).toContain("specs");
    expect(prompt).toContain("5");
    expect(prompt).toContain("8");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: FAIL with “buildQuestionPrompt is not exported” or missing.

**Step 3: Write minimal implementation**

```ts
// in convex/actions/generateQuestions.ts
const PHASE_QUESTION_RANGE: Record<string, { min: number; max: number }> = {
  brief: { min: 5, max: 8 },
  prd: { min: 5, max: 8 },
  specs: { min: 5, max: 8 },
  stories: { min: 4, max: 6 },
  artifacts: { min: 3, max: 5 },
  handoff: { min: 3, max: 5 },
};

export function buildQuestionPrompt(params: {
  title: string;
  description: string;
  phaseId: string;
  range: { min: number; max: number };
}): string {
  return `Generate ${params.range.min}-${params.range.max} specific, high-value questions for the ${params.phaseId} phase.\n\nProject Title: ${params.title}\nProject Description: ${params.description}\n\nReturn JSON: {"questions":[{"text":"...","required":true}]}`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generateQuestions.ts convex/actions/__tests__/generateQuestions.test.ts

git commit -m "feat: add prompt builder for ai question generation"
```

---

### Task 3: Wire AI question generation into Convex action with fallback

**Files:**
- Modify: `convex/actions/generateQuestions.ts`
- Modify: `lib/llm/client-factory.ts` (if needed)

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { normalizeQuestions } from "../generateQuestions";

describe("normalizeQuestions", () => {
  it("falls back to templates if AI output empty", () => {
    const result = normalizeQuestions([], "brief", { min: 5, max: 8 });
    expect(result.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// in convex/actions/generateQuestions.ts
// 1) Resolve credentials
// 2) Attempt LLM question generation with fetchWithTimeout using a lower timeout than 120s
// 3) Parse JSON with safe fallback
// 4) If invalid, fall back to template questions
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generateQuestions.ts convex/actions/__tests__/generateQuestions.test.ts

git commit -m "feat: generate ai questions with fallback"
```

---

### Task 4: Harden generatePhase against timeouts and stuck status

**Files:**
- Modify: `convex/actions/generatePhase.ts`
- Modify: `lib/llm/chunking.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { getSectionPlan } from "../../lib/llm/chunking";

describe("getSectionPlan", () => {
  it("keeps section counts within timeout budget", () => {
    const sections = getSectionPlan("prd", "prd");
    expect(sections.length).toBeLessThanOrEqual(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// in lib/llm/chunking.ts
// reduce PRD sections or chunk generation into multiple calls
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/llm/chunking.ts convex/actions/__tests__/generateQuestions.test.ts

git commit -m "fix: reduce prd sections to avoid timeouts"
```

---

### Task 5: Ensure question-to-section matching works

**Files:**
- Modify: `convex/actions/generatePhase.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { extractRelevantQuestions } from "../generatePhase";

describe("extractRelevantQuestions", () => {
  it("matches architecture-overview sections", () => {
    const questions = [{ text: "Describe architecture", answer: "A" }];
    const result = extractRelevantQuestions(questions as any, "architecture-overview");
    expect(result.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// in convex/actions/generatePhase.ts
// extend keyword map to include full section names used in section plan
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts convex/actions/__tests__/generateQuestions.test.ts

git commit -m "fix: align section keywords with section names"
```

---

### Task 6: Update UI phase config to include PRD and artifacts or unify phases

**Files:**
- Modify: `app/project/[id]/phase/[phaseId]/page.tsx`
- Modify: `components/phase-status.tsx`
- Modify: `convex/projects.ts`
- Modify: `lib/llm/artifact-types.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { getArtifactTypeForPhase } from "../../lib/llm/artifact-types";

describe("getArtifactTypeForPhase", () => {
  it("maps prd phase correctly when combined", () => {
    expect(getArtifactTypeForPhase("brief")).toBe("brief");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// update phase config to align with desired UI/flow
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/project/[id]/phase/[phaseId]/page.tsx components/phase-status.tsx convex/projects.ts lib/llm/artifact-types.ts

git commit -m "chore: align phase config across backend and ui"
```

---

### Task 7: Verify end-to-end

**Files:**
- None

**Step 1: Run typecheck**

Run: `bunx tsc --noEmit --project convex/tsconfig.json`
Expected: PASS

**Step 2: Run targeted tests**

Run: `bun test convex/actions/__tests__/generateQuestions.test.ts`
Expected: PASS

**Step 3: Manual smoke**

- Generate questions for each phase
- Use “Let AI answer all” then edit before accepting
- Generate phase and ensure status transitions to `ready` or `error` with no stuck `generating`

---

Plan complete.
