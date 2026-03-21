# Clarification → Artifact Wiring Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 issues in how clarification question answers are serialized, routed, and injected into artifact generation prompts — ensuring no data loss, better cross-phase context, and improved prompt quality.

**Architecture:** Structured Q&A is serialized using a delimiter-based format (replacing fragile `\n`/`:` splitting) and passed through the existing `projectContext` pipeline. Cross-phase context is fetched from upstream phase answers at generation time. Section-level coherence is achieved by forwarding previously-generated section content to subsequent sections within the same phase.

**Tech Stack:** TypeScript, Convex (serverless backend), Vitest

---

## Issue Map

| Issue | Task(s) | Severity |
|-------|---------|----------|
| 1: Q&A text parsing is fragile (newlines/colons break extraction) | Tasks 1-3 | Medium |
| 2: Question generation prompt lacks phase context | Task 4 | Low-Medium |
| 3: Batch answer prompt is less informative (no suggestions) | Task 5 | Low |
| 4: `previousSections` always empty in worker | Task 6 | Medium |
| 5: No cross-phase question context | Task 7 | Medium |
| 6: Handoff phase skips required answer validation for AI questions | Task 8 | Very Low |

---

### Task 1: Create Robust Q&A Serialization Helpers

The current format `"Q: A\nQ: A"` breaks when answers contain newlines or questions contain colons. Replace with a delimiter-based format using `\n---QA---\n` between pairs and `\n>>>ANSWER>>>\n` between question and answer.

**Files:**
- Create: `lib/llm/qa-serializer.ts`
- Create: `lib/llm/__tests__/qa-serializer.test.ts`

**Step 1: Write failing tests for serialize/deserialize round-trip**

```typescript
// lib/llm/__tests__/qa-serializer.test.ts
import { describe, test, expect } from 'vitest';
import { serializeQAPairs, deserializeQAPairs, type QAPair } from '../qa-serializer';

describe('serializeQAPairs', () => {
  test('serializes simple Q&A pairs', () => {
    const pairs: QAPair[] = [
      { question: 'What is the tech stack?', answer: 'Next.js, Convex' },
      { question: 'Who are the users?', answer: 'Developers' },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
  });

  test('handles answers with newlines', () => {
    const pairs: QAPair[] = [
      {
        question: 'What constraints exist?',
        answer: 'Must use PostgreSQL\nMust use TypeScript\nNo MongoDB',
      },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
  });

  test('handles questions with colons', () => {
    const pairs: QAPair[] = [
      {
        question: 'What defines success for this project: Key metrics or outcomes?',
        answer: 'Monthly active users > 10k',
      },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
  });

  test('handles empty array', () => {
    expect(serializeQAPairs([])).toBe('');
    expect(deserializeQAPairs('')).toEqual([]);
  });

  test('filters out pairs with empty answers', () => {
    const pairs: QAPair[] = [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: '' },
      { question: 'Q3', answer: 'A3' },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toHaveLength(2);
    expect(deserialized[0].question).toBe('Q1');
    expect(deserialized[1].question).toBe('Q3');
  });
});

describe('deserializeQAPairs', () => {
  test('handles legacy colon-separated format gracefully', () => {
    const legacy = 'What is the stack?: Next.js\nWho are users?: Developers';
    const pairs = deserializeQAPairs(legacy);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].question).toBe('What is the stack?');
    expect(pairs[0].answer).toBe('Next.js');
  });

  test('returns empty array for null/undefined input', () => {
    expect(deserializeQAPairs(null as any)).toEqual([]);
    expect(deserializeQAPairs(undefined as any)).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- lib/llm/__tests__/qa-serializer.test.ts`
Expected: FAIL — module `../qa-serializer` does not exist

**Step 3: Implement the serializer**

```typescript
// lib/llm/qa-serializer.ts

const PAIR_DELIMITER = '\n---QA---\n';
const ANSWER_DELIMITER = '\n>>>ANSWER>>>\n';

export interface QAPair {
  question: string;
  answer: string;
}

/**
 * Serializes Q&A pairs into a format that safely handles newlines and colons.
 * Filters out pairs with empty answers.
 */
export function serializeQAPairs(pairs: QAPair[]): string {
  return pairs
    .filter((p) => p.answer?.trim())
    .map((p) => `${p.question}${ANSWER_DELIMITER}${p.answer}`)
    .join(PAIR_DELIMITER);
}

/**
 * Deserializes Q&A pairs. Supports both the new delimiter format and
 * the legacy "Q: A\nQ: A" format for backward compatibility.
 */
export function deserializeQAPairs(text: string | null | undefined): QAPair[] {
  if (!text?.trim()) return [];

  // New format: uses delimiters
  if (text.includes(ANSWER_DELIMITER)) {
    return text
      .split(PAIR_DELIMITER)
      .filter((block) => block.includes(ANSWER_DELIMITER))
      .map((block) => {
        const delimIndex = block.indexOf(ANSWER_DELIMITER);
        return {
          question: block.substring(0, delimIndex).trim(),
          answer: block.substring(delimIndex + ANSWER_DELIMITER.length).trim(),
        };
      })
      .filter((p) => p.question && p.answer);
  }

  // Legacy format: "Question: Answer\nQuestion: Answer"
  return text
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => {
      const colonIndex = line.indexOf(':');
      return {
        question: line.substring(0, colonIndex).trim(),
        answer: line.substring(colonIndex + 1).trim(),
      };
    })
    .filter((p) => p.question && p.answer);
}

/**
 * Formats Q&A pairs for human-readable prompt injection.
 * Used in system prompts where the LLM needs to read the Q&A as context.
 */
export function formatQAForPrompt(pairs: QAPair[]): string {
  return pairs.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n');
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- lib/llm/__tests__/qa-serializer.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add lib/llm/qa-serializer.ts lib/llm/__tests__/qa-serializer.test.ts
git commit -m "feat: add robust Q&A serialization with delimiter-based format

Replaces fragile newline/colon splitting with explicit delimiters
that handle multi-line answers and questions containing colons.
Includes backward-compatible legacy format parsing."
```

---

### Task 2: Wire Q&A Serializer into `generatePhase.ts` (Serialization Side)

Replace the fragile `questionsText` concatenation in `generatePhase` with `serializeQAPairs()`, and update `generateSectionContent`/`generateSectionContentStreaming` to use `formatQAForPrompt()` for prompt injection.

**Files:**
- Modify: `convex/actions/generatePhase.ts:174-176` (serialization)
- Modify: `convex/actions/generatePhase.ts:429-436` (system prompt in `generateSectionContent`)
- Modify: `convex/actions/generatePhase.ts:541-548` (system prompt in `generateSectionContentStreaming`)
- Modify: `convex/actions/generatePhase.ts:460-463` (user prompt — sectionQuestions formatting)
- Modify: `convex/actions/generatePhase.ts:566-569` (user prompt streaming — sectionQuestions formatting)

**Step 1: Update the serialization at `generatePhase` action**

In `convex/actions/generatePhase.ts`, replace lines 174-176:

```typescript
// BEFORE:
const questionsText = answeredQuestions
  .map((q: Question) => `${q.text}: ${q.answer}`)
  .join('\n');

// AFTER:
import { serializeQAPairs, formatQAForPrompt, deserializeQAPairs } from '../../lib/llm/qa-serializer';

const questionsText = serializeQAPairs(
  answeredQuestions.map((q: Question) => ({
    question: q.text,
    answer: q.answer || '',
  }))
);
```

**Step 2: Update `generateSectionContent` system prompt to use human-readable format**

In `generateSectionContent` (line ~435), replace the questions injection:

```typescript
// BEFORE:
${params.projectContext.questions ? `User Requirements & Clarifications:\n${params.projectContext.questions}\n` : ''}

// AFTER:
${params.projectContext.questions ? `User Requirements & Clarifications:\n${formatQAForPrompt(deserializeQAPairs(params.projectContext.questions))}\n` : ''}
```

Apply the same change to `generateSectionContentStreaming` (line ~547).

**Step 3: Update user prompt sectionQuestions formatting**

The `sectionQuestions` array is already `string[]` from `extractRelevantQuestionsForSection`, so the user prompt `Address these points:` formatting stays the same — but its source data will now be correctly parsed (see Task 3).

**Step 4: Run typecheck and existing tests**

Run: `npm run typecheck && npm test -- convex/__tests__/`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts
git commit -m "refactor: use Q&A serializer for question text in generatePhase

Replaces fragile colon-newline concatenation with delimiter-based
serialization. Prompts now use human-readable Q/A format."
```

---

### Task 3: Wire Q&A Serializer into `extractRelevantQuestionsForSection` (Deserialization Side)

Replace the fragile text parsing in `extractRelevantQuestionsForSection` with `deserializeQAPairs()`.

**Files:**
- Modify: `convex/internalActions.ts:928-949` (parsing logic)
- Modify: `convex/internalActions.ts:1349-1367` (scoring and return)

**Step 1: Write a test for extractRelevantQuestionsForSection with tricky input**

```typescript
// Add to convex/__tests__/generateQuestionsWorker.test.ts (or create new file)
import { describe, test, expect } from 'vitest';

// We'll test extractRelevantQuestionsForSection after it's exported
// For now, test via the serializer integration
import { serializeQAPairs, deserializeQAPairs } from '../../lib/llm/qa-serializer';

describe('Q&A serialization round-trip with section extraction', () => {
  test('preserves multi-line answers through serialize/deserialize', () => {
    const pairs = [
      {
        question: 'What constraints exist?',
        answer: 'Must use PostgreSQL\nRedis for caching\nNo MongoDB',
      },
      {
        question: 'What is the tech stack?',
        answer: 'Next.js 16, Convex, Tailwind',
      },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
    expect(deserialized[0].answer).toContain('\n');
  });
});
```

**Step 2: Run test to verify it passes (serializer already works)**

Run: `npm test -- convex/__tests__/generateQuestionsWorker.test.ts`
Expected: PASS

**Step 3: Update `extractRelevantQuestionsForSection` to use deserializer**

In `convex/internalActions.ts`, replace lines 928-949:

```typescript
// BEFORE:
function extractRelevantQuestionsForSection(
  questionsText: string,
  sectionName: string,
  phaseId: string,
): string[] {
  if (!questionsText || questionsText.trim().length === 0) {
    return [];
  }

  const qaPairs = questionsText
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => {
      const colonIndex = line.indexOf(':');
      return {
        question: line.substring(0, colonIndex).trim(),
        answer: line.substring(colonIndex + 1).trim(),
      };
    })
    .filter((qa) => qa.question && qa.answer);

// AFTER:
import { deserializeQAPairs, type QAPair } from '../../lib/llm/qa-serializer';

function extractRelevantQuestionsForSection(
  questionsText: string,
  sectionName: string,
  phaseId: string,
): string[] {
  if (!questionsText || questionsText.trim().length === 0) {
    return [];
  }

  const qaPairs = deserializeQAPairs(questionsText);
```

Then update the return format at lines 1358-1367 to use `QAPair` shape:

```typescript
// The scoring logic stays the same, but operates on QAPair objects.
// The existing code already uses qa.question and qa.answer — no change needed
// in the keyword scoring block (lines 1349-1356).

// Update return format at line 1362:
  .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`);

// And the fallback at line 1346 and 1366:
  return qaPairs.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`);
```

**Step 4: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/internalActions.ts
git commit -m "fix: use robust Q&A deserializer in extractRelevantQuestionsForSection

Eliminates data corruption when answers contain newlines or
questions contain colons. Backward-compatible with legacy format."
```

---

### Task 4: Enrich Question Generation Prompt with Phase Context

The `buildQuestionPrompt()` in `generateQuestions.ts` gives the LLM no context about what the phase produces. Add phase descriptions and section names so the LLM generates questions aligned with the artifact sections.

**Files:**
- Modify: `convex/actions/generateQuestions.ts:133-147`
- Test: `convex/__tests__/question-suggestions.test.ts`

**Step 1: Write a test for the enriched prompt**

Add to `convex/__tests__/question-suggestions.test.ts`:

```typescript
describe('buildQuestionPrompt', () => {
  // ... existing tests ...

  test('includes phase description in prompt', () => {
    const prompt = buildQuestionPrompt({
      title: 'Test Project',
      description: 'A test project',
      phaseId: 'specs',
      range: { min: 5, max: 8 },
    });
    expect(prompt).toContain('Technical Specifications');
    expect(prompt).toContain('architecture');
  });

  test('includes section names in prompt for targeted questions', () => {
    const prompt = buildQuestionPrompt({
      title: 'Test Project',
      description: 'A test project',
      phaseId: 'constitution',
      range: { min: 4, max: 6 },
    });
    expect(prompt).toContain('locked-constraints');
    expect(prompt).toContain('tech-stack');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/__tests__/question-suggestions.test.ts`
Expected: FAIL — prompt does not contain phase description

**Step 3: Update `buildQuestionPrompt` with phase context**

```typescript
// convex/actions/generateQuestions.ts

// Add phase metadata map (above buildQuestionPrompt)
const PHASE_CONTEXT: Record<string, { description: string; sections: string[] }> = {
  constitution: {
    description: 'Project Constitution — immutable standards and constraints governing the entire project',
    sections: ['locked-constraints', 'architecture-decisions', 'tech-stack', 'quality-and-standards'],
  },
  brief: {
    description: 'Project Brief — high-level overview, problem statement, goals, and target audience',
    sections: ['problem-and-objectives', 'features-and-requirements', 'target-audience'],
  },
  prd: {
    description: 'Product Requirements Document — detailed requirements, user personas, and success metrics',
    sections: ['executive-summary', 'problem-statement', 'goals-and-objectives', 'user-personas', 'requirements', 'success-metrics'],
  },
  domainModel: {
    description: 'Domain Model — core entities, relationships, state transitions, and invariants',
    sections: ['entity-definitions', 'entity-relationships', 'state-transitions'],
  },
  specs: {
    description: 'Technical Specifications — architecture, data models, API design, security, and deployment',
    sections: ['architecture-overview', 'data-models', 'api-design', 'component-architecture', 'security-considerations', 'deployment-strategy'],
  },
  stories: {
    description: 'User Stories & Tasks — epics, user stories with acceptance criteria, and technical tasks',
    sections: ['epic-overview', 'user-stories', 'technical-tasks', 'acceptance-criteria'],
  },
  artifacts: {
    description: 'Technical Artifacts — API documentation, database schemas, environment config, deployment scripts',
    sections: ['api-documentation', 'database-schema', 'environment-config', 'deployment-scripts'],
  },
  handoff: {
    description: 'Project Handoff — summary, setup guide, implementation guide, and next steps',
    sections: ['project-summary', 'setup-guide', 'implementation-guide', 'next-steps'],
  },
};

export function buildQuestionPrompt(params: {
  title: string;
  description: string;
  phaseId: string;
  range: { min: number; max: number };
}): string {
  const phaseCtx = PHASE_CONTEXT[params.phaseId];
  const phaseDesc = phaseCtx?.description ?? params.phaseId;
  const sectionsList = phaseCtx?.sections?.join(', ') ?? '';

  return (
    `Generate ${params.range.min}-${params.range.max} specific, high-value questions for the "${params.phaseId}" phase.\n\n` +
    `Phase Purpose: ${phaseDesc}\n` +
    (sectionsList ? `Sections this phase will generate: ${sectionsList}\n\n` : '\n') +
    `Project Title: ${params.title}\n` +
    `Project Description: ${params.description}\n\n` +
    `Ask questions whose answers will directly inform the content of the sections listed above. ` +
    `Focus on decisions, constraints, and preferences that the user must clarify before generating each section.\n\n` +
    `For each question, also provide 3-5 selectable suggestion options that represent common answers.\n\n` +
    `Return JSON only in this shape:\n` +
    `{"questions":[{"text":"...","required":true,"suggestions":["Option A","Option B","Option C"]}]}`
  );
}
```

**Step 4: Run tests**

Run: `npm test -- convex/__tests__/question-suggestions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generateQuestions.ts convex/__tests__/question-suggestions.test.ts
git commit -m "feat: enrich question generation prompt with phase descriptions and sections

LLM now knows what artifacts each phase produces, generating
questions better aligned with downstream section content."
```

---

### Task 5: Align Batch Answer Prompt with Single Answer Quality

The batch prompt (`buildBatchQuestionPrompt`) produces raw text with no structure guidance. Align it closer to the single-question prompt by requesting specificity and actionability, while keeping it non-JSON for efficiency.

**Files:**
- Modify: `convex/actions/generateAllQuestionAnswers.ts:167-183`
- Modify: `convex/internalActions.ts:849-858` (inline prompt in worker)

**Step 1: Update `buildBatchQuestionPrompt`**

```typescript
// convex/actions/generateAllQuestionAnswers.ts — replace lines 167-183
function buildBatchQuestionPrompt(params: {
  projectTitle: string;
  projectDescription: string;
  questionText: string;
  previousAnswers: string;
}): string {
  return `You are a senior software architect helping answer clarification questions for a software project specification.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousAnswers ? `Previously answered questions in this session:\n${params.previousAnswers}\n\n` : ''}Question: ${params.questionText}

Provide a clear, specific, and actionable answer. Include concrete details (e.g., specific technologies, patterns, metrics) rather than generic guidance. Maintain consistency with any previous answers above. Keep the answer concise (2-4 sentences).`;
}
```

**Step 2: Update the inline prompt in `generateQuestionsWorker`**

In `convex/internalActions.ts` lines 849-858, replace the inline prompt with a call to the exported `buildBatchQuestionPrompt` — or duplicate the improved prompt inline (since the worker is in a different file and importing from actions is not idiomatic in Convex internals).

Replace lines 849-858:

```typescript
const prompt = `You are a senior software architect helping answer clarification questions for a software project specification.

Project Title: ${projectContext.title}
Project Description: ${projectContext.description}

${previousAnswers ? `Previously answered questions in this session:\n${previousAnswers}\n\n` : ''}Question: ${question.text}

Provide a clear, specific, and actionable answer. Include concrete details (e.g., specific technologies, patterns, metrics) rather than generic guidance. Maintain consistency with any previous answers above. Keep the answer concise (2-4 sentences).`;
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/actions/generateAllQuestionAnswers.ts convex/internalActions.ts
git commit -m "refactor: improve batch question answer prompt quality

Aligns batch answer prompt with single-question quality by
requesting specific, actionable answers with concrete details."
```

---

### Task 6: Forward `previousSections` Content in Worker

The `generatePhaseWorker` always passes `previousSections: []`. Since sections are generated sequentially (each step schedules the next), we can accumulate content and pass it to subsequent sections.

**Files:**
- Modify: `convex/internalActions.ts:198-510` (generatePhaseWorker)
- Modify: `convex/internal.ts` (add query to fetch accumulated section content)

**Step 1: Add internal query to fetch current artifact content by sections**

In `convex/internal.ts`, add a new internal query:

```typescript
export const getArtifactSectionsInternal = internalQuery({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .first();
    if (!artifact) return [];
    // Return section metadata — content is in the artifact's `content` field
    // We need to parse sections from the accumulated content
    return (artifact.sections || []).map((s: { name: string; tokens: number; model: string }) => ({
      name: s.name,
    }));
  },
});
```

**Step 2: Update `generatePhaseWorker` to fetch and forward previous section content**

The artifact content is appended incrementally via streaming. After a section completes (line ~496), its content is already in the artifact. We can fetch the full artifact content and extract completed section content for the next section's prompt.

In `convex/internalActions.ts`, after the section metadata is recorded (line ~496), before scheduling the next step (line ~505):

```typescript
// At the top of generatePhaseWorker handler, add:
// Fetch previous sections' content for coherence
let previousSections: Array<{ name: string; content: string }> = [];
if (currentStep > 0) {
  const artifact = await ctx.runQuery(
    internal.internal.getArtifactByPhaseInternal,
    { projectId, phaseId },
  );
  if (artifact?.content) {
    // Extract the last completed section's content (keep it short to stay within context)
    // Use the last 2000 chars as a summary of previous work
    const prevContent = artifact.content;
    const truncated = prevContent.length > 3000
      ? prevContent.slice(-3000)
      : prevContent;
    previousSections = [{ name: 'previous-content', content: truncated }];
  }
}
```

Then update both the critique and non-critique paths to pass `previousSections`:

```typescript
// Line ~391 and ~443: change previousSections: [] to previousSections
previousSections,
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/internalActions.ts convex/internal.ts
git commit -m "feat: forward previous section content to subsequent sections in worker

Sections now receive context from earlier sections in the same
phase, reducing repetition and improving cross-section coherence."
```

---

### Task 7: Inject Cross-Phase Question Context into Artifact Generation

Later phases (specs, stories, artifacts, handoff) should see answered questions from their upstream dependency phases, not just the current phase's questions.

**Files:**
- Modify: `convex/actions/generatePhase.ts:106-176` (question collection in `generatePhase`)
- Use: `lib/specification/dependency-graph.ts` (`PHASE_DEPENDENCIES`)

**Step 1: Write a test for upstream question aggregation**

Create `convex/__tests__/upstream-context.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { PHASE_DEPENDENCIES } from '../../lib/specification/dependency-graph';

describe('upstream question context', () => {
  test('specs phase depends on prd, domainModel, and constitution', () => {
    expect(PHASE_DEPENDENCIES['specs']).toContain('prd');
    expect(PHASE_DEPENDENCIES['specs']).toContain('domainModel');
    expect(PHASE_DEPENDENCIES['specs']).toContain('constitution');
  });

  test('stories phase depends on specs, prd, and constitution', () => {
    expect(PHASE_DEPENDENCIES['stories']).toContain('specs');
    expect(PHASE_DEPENDENCIES['stories']).toContain('prd');
    expect(PHASE_DEPENDENCIES['stories']).toContain('constitution');
  });

  test('brief and constitution have no dependencies', () => {
    expect(PHASE_DEPENDENCIES['brief']).toEqual([]);
    expect(PHASE_DEPENDENCIES['constitution']).toEqual([]);
  });
});
```

**Step 2: Run test to verify it passes (dependency graph already correct)**

Run: `npm test -- convex/__tests__/upstream-context.test.ts`
Expected: PASS

**Step 3: Update `generatePhase` to collect upstream phase questions**

In `convex/actions/generatePhase.ts`, after fetching the current phase's answered questions (line ~116), add upstream question collection:

```typescript
import { PHASE_DEPENDENCIES } from '../../lib/specification/dependency-graph';
import { serializeQAPairs } from '../../lib/llm/qa-serializer';

// After line 116: const answeredQuestions = questions.filter((q: Question) => q.answer);

// Collect upstream phase questions for cross-phase context
const upstreamPhaseIds = PHASE_DEPENDENCIES[args.phaseId] || [];
const upstreamQAPairs: Array<{ question: string; answer: string }> = [];

for (const upstreamPhaseId of upstreamPhaseIds) {
  const upstreamPhase = await ctx.runQuery(
    internalApi.internal.getPhaseInternal,
    { projectId: args.projectId, phaseId: upstreamPhaseId },
  );
  if (upstreamPhase?.questions) {
    const upstreamAnswered = upstreamPhase.questions
      .filter((q: Question) => q.answer)
      .map((q: Question) => ({
        question: `[${upstreamPhaseId}] ${q.text}`,
        answer: q.answer || '',
      }));
    upstreamQAPairs.push(...upstreamAnswered);
  }
}

// Combine: current phase questions + upstream phase questions
const allQAPairs = [
  ...answeredQuestions.map((q: Question) => ({
    question: q.text,
    answer: q.answer || '',
  })),
  ...upstreamQAPairs,
];

const questionsText = serializeQAPairs(allQAPairs);
```

This replaces the existing `questionsText` construction at lines 174-176.

**Step 4: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts convex/__tests__/upstream-context.test.ts
git commit -m "feat: inject upstream phase question answers into artifact generation

Later phases (specs, stories, etc.) now receive clarification
answers from their dependency phases, ensuring cross-phase
consistency and richer context for artifact generation."
```

---

### Task 8: Validate AI-Generated Required Questions for Handoff Phase

The handoff phase bypasses `hasMissingRequiredAnswers` entirely. Instead of skipping validation, only skip it for the *base* questions (which have no required fields), but still validate if AI-generated questions marked `required: true` exist.

**Files:**
- Modify: `convex/actions/generatePhase.ts:118-120`

**Step 1: Write a test for the edge case**

Add to an existing test file or create `convex/__tests__/handoff-validation.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { hasMissingRequiredAnswers } from '../actions/generatePhase';

describe('hasMissingRequiredAnswers', () => {
  test('returns false when no required questions exist', () => {
    const questions = [
      { id: 'q1', text: 'Q1', aiGenerated: false },
      { id: 'q2', text: 'Q2', answer: 'A2', aiGenerated: false },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(false);
  });

  test('returns true when required question has no answer', () => {
    const questions = [
      { id: 'q1', text: 'Q1', required: true, aiGenerated: true },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(true);
  });

  test('returns false when all required questions are answered', () => {
    const questions = [
      { id: 'q1', text: 'Q1', required: true, answer: 'A1', aiGenerated: true },
      { id: 'q2', text: 'Q2', aiGenerated: false },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(false);
  });

  test('returns true when required question answer is whitespace only', () => {
    const questions = [
      { id: 'q1', text: 'Q1', required: true, answer: '   ', aiGenerated: false },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `npm test -- convex/__tests__/handoff-validation.test.ts`
Expected: PASS (function already handles this correctly)

**Step 3: Remove the handoff exception**

In `convex/actions/generatePhase.ts`, line 118:

```typescript
// BEFORE:
if (hasMissingRequiredAnswers(questions) && args.phaseId !== 'handoff') {
  throw new Error('Please answer all required questions before generating');
}

// AFTER:
if (hasMissingRequiredAnswers(questions)) {
  throw new Error('Please answer all required questions before generating');
}
```

Since handoff's base questions have no `required` field, this changes nothing for base questions. But if AI generates required questions for handoff, they'll now be validated.

**Step 4: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts convex/__tests__/handoff-validation.test.ts
git commit -m "fix: validate required questions for all phases including handoff

Removes special-case handoff exception. Base handoff questions
have no required fields so behavior is unchanged, but AI-generated
required questions are now properly validated."
```

---

### Task 9: Final Integration Test & Cleanup

**Step 1: Run full test suite**

Run: `npm run typecheck && npm run lint -- --max-warnings=0 && npm test`
Expected: All PASS

**Step 2: Verify no duplicate Q&A extraction logic remains**

Check that `extractRelevantQuestions` in `generatePhase.ts:688-771` (the legacy version that operates on `Question[]` directly) is still used by `generateSectionsWithSelfCritique` at line 337. This function takes structured `Question[]` objects, not serialized text — it's a separate code path and should remain untouched.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification for clarification-artifact wiring"
```

---

## Dependency Graph

```
Task 1 (serializer) ──┬──> Task 2 (serialize side) ──┬──> Task 9 (integration)
                       │                               │
                       └──> Task 3 (deserialize side) ─┘
                                                        │
Task 4 (question prompt) ──────────────────────────────>│
Task 5 (batch prompt) ─────────────────────────────────>│
Task 6 (previousSections) ─────────────────────────────>│
Task 7 (cross-phase) ── depends on Task 2 ────────────>│
Task 8 (handoff validation) ───────────────────────────>│
```

Tasks 1, 4, 5, 6, 8 can be developed in parallel.
Tasks 2, 3, 7 depend on Task 1.
Task 9 depends on all others.
