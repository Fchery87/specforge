# LLM Output Continuation & Adaptive Splitting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure artifact generation never truncates by auto-continuing on length stops and dynamically splitting oversized sections based on model output limits.

**Architecture:** Add finish-reason awareness to normalized LLM responses, implement continuation loops in section generation, and adaptively split section plans when estimated output exceeds per-call budgets. Preserve existing provider integrations while using model metadata for auto-calculation.

**Tech Stack:** TypeScript, Convex actions, Vitest

---

### Task 1: Add finish reason to normalized responses

**Files:**
- Modify: `lib/llm/response-normalizer.ts`
- Modify: `lib/llm/types.ts`
- Test: `lib/llm/__tests__/response-normalizer.test.ts`

**Step 1: Write the failing test**

```ts
import { normalizeOpenAIResponse } from "../response-normalizer";

test("normalizeOpenAIResponse returns finishReason", () => {
  const result = normalizeOpenAIResponse({
    choices: [{
      finish_reason: "length",
      message: { content: "partial" },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  });

  expect(result.finishReason).toBe("length");
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest lib/llm/__tests__/response-normalizer.test.ts`
Expected: FAIL with "finishReason" undefined.

**Step 3: Write minimal implementation**

```ts
export interface NormalizedResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
}

// in normalizeOpenAIResponse
const finishReason = data.choices?.[0]?.finish_reason;
return { content, usage: ..., finishReason };
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest lib/llm/__tests__/response-normalizer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/llm/response-normalizer.ts lib/llm/types.ts lib/llm/__tests__/response-normalizer.test.ts
git commit -m "test: normalize finish reason in LLM responses"
```

---

### Task 2: Add continuation helper for truncated responses

**Files:**
- Create: `lib/llm/continuation.ts`
- Test: `lib/llm/__tests__/continuation.test.ts`

**Step 1: Write the failing test**

```ts
import { continueIfTruncated } from "../continuation";

test("continues when finishReason is length", async () => {
  const calls: string[] = [];
  const complete = async (prompt: string) => {
    calls.push(prompt);
    if (calls.length === 1) {
      return { content: "Part 1", usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }, finishReason: "length" };
    }
    return { content: "Part 2", usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }, finishReason: "stop" };
  };

  const result = await continueIfTruncated({
    prompt: "Generate",
    complete,
    maxTurns: 3,
    continuationPrompt: (soFar) => `Continue from: ${soFar}`,
  });

  expect(result.content).toBe("Part 1\n\nPart 2");
  expect(calls.length).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest lib/llm/__tests__/continuation.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

```ts
export async function continueIfTruncated({ prompt, complete, continuationPrompt, maxTurns }: {
  prompt: string;
  complete: (prompt: string) => Promise<{ content: string; finishReason?: string }>;
  continuationPrompt: (soFar: string) => string;
  maxTurns: number;
}) {
  let content = "";
  let currentPrompt = prompt;
  for (let i = 0; i < maxTurns; i++) {
    const response = await complete(currentPrompt);
    content = content ? `${content}\n\n${response.content}` : response.content;
    if (response.finishReason !== "length") {
      return { content };
    }
    currentPrompt = continuationPrompt(content);
  }
  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest lib/llm/__tests__/continuation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/llm/continuation.ts lib/llm/__tests__/continuation.test.ts
git commit -m "test: add continuation helper for truncated LLM output"
```

---

### Task 3: Use continuation in section generation

**Files:**
- Modify: `convex/actions/generatePhase.ts`
- Test: `convex/actions/__tests__/generatePhase.test.ts`

**Step 1: Write the failing test**

```ts
import { generateSectionContent } from "../generatePhase";

test("generateSectionContent continues when model truncates", async () => {
  const responses = [
    { content: "Part 1", finishReason: "length" },
    { content: "Part 2", finishReason: "stop" },
  ];
  const llmClient = {
    complete: async () => responses.shift(),
  } as any;

  const result = await generateSectionContent({
    projectContext: { title: "T", description: "D", questions: "" },
    sectionName: "test",
    sectionInstructions: "",
    sectionQuestions: [],
    previousSections: [],
    model: { id: "m", provider: "openai", contextTokens: 1, maxOutputTokens: 2000, defaultMax: 1000 },
    maxTokens: 2000,
    llmClient,
    providerInfo: "",
    phaseId: "brief",
  });

  expect(result).toContain("Part 1");
  expect(result).toContain("Part 2");
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest convex/actions/__tests__/generatePhase.test.ts`
Expected: FAIL (no continuation).

**Step 3: Write minimal implementation**

```ts
import { continueIfTruncated } from "../../lib/llm/continuation";

const response = await continueIfTruncated({
  prompt: `${systemPrompt}\n\n${userPrompt}`,
  maxTurns: 3,
  complete: (prompt) => llmClient.complete(prompt, { ... }),
  continuationPrompt: (soFar) => `${systemPrompt}\n\nContinue from the last sentence. Do not repeat content.\n\nCurrent content:\n${soFar}`,
});

return response.content;
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest convex/actions/__tests__/generatePhase.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts convex/actions/__tests__/generatePhase.test.ts
git commit -m "test: continue section generation when truncated"
```

---

### Task 4: Adaptive section splitting based on output budget

**Files:**
- Modify: `lib/llm/chunking.ts`
- Test: `lib/llm/__tests__/chunking.test.ts`

**Step 1: Write the failing test**

```ts
import { expandSectionsForBudget } from "../chunking";

test("expands section names when estimated tokens exceed budget", () => {
  const expanded = expandSectionsForBudget({
    sectionNames: ["architecture-overview"],
    estimatedTokens: 12000,
    maxTokensPerSection: 4000,
  });

  expect(expanded.length).toBe(3);
  expect(expanded[0]).toBe("architecture-overview-part-1");
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest lib/llm/__tests__/chunking.test.ts`
Expected: FAIL (helper missing).

**Step 3: Write minimal implementation**

```ts
export function expandSectionsForBudget({ sectionNames, estimatedTokens, maxTokensPerSection }: {
  sectionNames: string[];
  estimatedTokens: number;
  maxTokensPerSection: number;
}): string[] {
  if (sectionNames.length !== 1) return sectionNames;
  const needed = Math.max(1, Math.ceil(estimatedTokens / maxTokensPerSection));
  if (needed === 1) return sectionNames;
  return Array.from({ length: needed }, (_, i) => `${sectionNames[0]}-part-${i + 1}`);
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest lib/llm/__tests__/chunking.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/llm/chunking.ts lib/llm/__tests__/chunking.test.ts
git commit -m "test: expand section plans for output budget"
```

---

### Task 5: Use adaptive splitting in section planning

**Files:**
- Modify: `convex/actions/generatePhase.ts`
- Test: `convex/actions/__tests__/generatePhase.test.ts`

**Step 1: Write the failing test**

```ts
import { planSectionsForPhase } from "../generatePhase";

test("planSectionsForPhase expands section when budget too small", () => {
  const plan = planSectionsForPhase({
    sectionNames: ["architecture-overview"],
    estimatedTokens: 12000,
    model: { id: "m", provider: "openai", contextTokens: 1, maxOutputTokens: 4000, defaultMax: 2000 },
  });

  expect(plan.length).toBe(3);
});
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest convex/actions/__tests__/generatePhase.test.ts`
Expected: FAIL (helper missing).

**Step 3: Write minimal implementation**

```ts
export function planSectionsForPhase({ sectionNames, estimatedTokens, model }: { ... }) {
  const maxTokensPerSection = Math.max(256, Math.floor(model.maxOutputTokens * 0.8));
  const expandedNames = expandSectionsForBudget({ sectionNames, estimatedTokens, maxTokensPerSection });
  return planSections(model, expandedNames, 0.8);
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest convex/actions/__tests__/generatePhase.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts convex/actions/__tests__/generatePhase.test.ts
git commit -m "test: plan sections with adaptive splitting"
```

---

### Task 6: Full check

**Step 1: Run targeted tests**

Run: `bunx vitest lib/llm/__tests__/response-normalizer.test.ts lib/llm/__tests__/continuation.test.ts lib/llm/__tests__/chunking.test.ts convex/actions/__tests__/generatePhase.test.ts`
Expected: PASS

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit --project convex/tsconfig.json`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/actions/generatePhase.ts lib/llm/chunking.ts lib/llm/continuation.ts lib/llm/response-normalizer.ts lib/llm/types.ts

git commit -m "feat: prevent truncated artifacts with adaptive splitting"
```
