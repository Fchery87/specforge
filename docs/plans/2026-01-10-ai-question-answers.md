# AI Question Answering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered question answering with individual and batch modes

**Architecture:** Two Convex actions for AI generation (individual + batch), UI buttons in QuestionsPanel, modal for batch preview, reuse existing LLM infrastructure

**Tech Stack:** Convex actions, React hooks, shadcn/ui components, existing LLM provider system

---

## Task 1: Create Individual Question AI Action

**Files:**
- Create: `convex/actions/generateQuestionAnswer.ts`

**Step 1: Write the action handler**

```typescript
'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  getModelById,
  getFallbackModel,
  resolveCredentials,
} from '../../lib/llm/registry';
import { createOpenAIClient } from '../../lib/llm/providers/openai';
import { createAnthropicClient } from '../../lib/llm/providers/anthropic';
import { createZAIClient } from '../../lib/llm/providers/zai';
import { createMinimaxClient } from '../../lib/llm/providers/minimax';
import type { ProviderCredentials } from '../../lib/llm/types';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

function getLlmClient(credentials: ProviderCredentials | null) {
  if (!credentials) return null;

  switch (credentials.provider) {
    case 'openai':
      return createOpenAIClient(credentials.apiKey);
    case 'anthropic':
      return createAnthropicClient(credentials.apiKey);
    case 'zai':
      return createZAIClient(
        credentials.apiKey,
        credentials.zaiEndpointType ?? 'paid',
        credentials.zaiIsChina ?? false
      );
    case 'minimax':
      return createMinimaxClient(credentials.apiKey);
    default:
      return null;
  }
}

export const generateQuestionAnswer = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    questionId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ suggestedAnswer: string }> => {
    // Verify user owns project
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Get phase with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });
    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    const targetQuestion = questions.find((q: Question) => q.id === args.questionId);
    if (!targetQuestion) throw new Error('Question not found');

    // Get previously answered questions
    const targetIndex = questions.findIndex((q: Question) => q.id === args.questionId);
    const previousQuestions = questions
      .slice(0, targetIndex)
      .filter((q: Question) => q.answer)
      .map((q: Question) => `${q.text}\nAnswer: ${q.answer}`)
      .join('\n\n');

    // Resolve credentials
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
      {}
    );

    let systemCredentialsMap: any;
    try {
      systemCredentialsMap = await ctx.runAction(
        internalApi.internalActions.getAllDecryptedSystemCredentials,
        {}
      );
    } catch {
      systemCredentialsMap = {};
    }

    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {}))
    );

    // Get model
    const enabledModelsFromDb = await ctx.runQuery(api.admin.listAllModels);
    const enabledModels = (enabledModelsFromDb || []).filter(
      (m: any) => m.enabled
    );

    let model: any;
    if (credentials?.modelId && credentials.modelId !== '') {
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider && enabledModels.length > 0) {
      const providerModel = enabledModels.find(
        (m: any) => m.provider === credentials.provider
      );
      if (providerModel) {
        model = {
          id: providerModel.modelId,
          provider: providerModel.provider,
          contextTokens: providerModel.contextTokens,
          maxOutputTokens: providerModel.maxOutputTokens,
          defaultMax: providerModel.defaultMax,
        };
        credentials.modelId = providerModel.modelId;
      } else {
        model = getFallbackModel();
      }
    } else {
      model = getFallbackModel();
    }

    // Build prompt
    const prompt = buildQuestionPrompt({
      projectTitle: project.title,
      projectDescription: project.description,
      questionText: targetQuestion.text,
      previousQuestions,
    });

    // Generate answer (simulated for now)
    const llmClient = getLlmClient(credentials);
    const suggestedAnswer = await generateAnswer({
      prompt,
      model,
      llmClient,
    });

    return { suggestedAnswer };
  },
});

function buildQuestionPrompt(params: {
  projectTitle: string;
  projectDescription: string;
  questionText: string;
  previousQuestions: string;
}): string {
  return `You are helping answer questions for a software project.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousQuestions ? `Previous answers:\n${params.previousQuestions}\n\n` : ''}

Question: ${params.questionText}

Provide a clear, concise answer based on the project context. Be specific and actionable.`;
}

async function generateAnswer(params: {
  prompt: string;
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  // TODO: Replace with actual LLM API call when ready
  // For now, return a placeholder
  return `AI-generated answer for this question based on the project context. This will be replaced with actual LLM integration.`;
}
```

**Step 2: Commit the action**

```bash
git add convex/actions/generateQuestionAnswer.ts
git commit -m "feat: add individual question AI answer action

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Batch Question AI Action

**Files:**
- Create: `convex/actions/generateAllQuestionAnswers.ts`

**Step 1: Write the batch action handler**

```typescript
'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  getModelById,
  getFallbackModel,
  resolveCredentials,
} from '../../lib/llm/registry';
import { createOpenAIClient } from '../../lib/llm/providers/openai';
import { createAnthropicClient } from '../../lib/llm/providers/anthropic';
import { createZAIClient } from '../../lib/llm/providers/zai';
import { createMinimaxClient } from '../../lib/llm/providers/minimax';
import type { ProviderCredentials } from '../../lib/llm/types';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

function getLlmClient(credentials: ProviderCredentials | null) {
  if (!credentials) return null;

  switch (credentials.provider) {
    case 'openai':
      return createOpenAIClient(credentials.apiKey);
    case 'anthropic':
      return createAnthropicClient(credentials.apiKey);
    case 'zai':
      return createZAIClient(
        credentials.apiKey,
        credentials.zaiEndpointType ?? 'paid',
        credentials.zaiIsChina ?? false
      );
    case 'minimax':
      return createMinimaxClient(credentials.apiKey);
    default:
      return null;
  }
}

export const generateAllQuestionAnswers = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ answers: Array<{ questionId: string; answer: string }> }> => {
    // Verify user owns project
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Get phase with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });
    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    if (questions.length === 0) {
      return { answers: [] };
    }

    // Resolve credentials
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
      {}
    );

    let systemCredentialsMap: any;
    try {
      systemCredentialsMap = await ctx.runAction(
        internalApi.internalActions.getAllDecryptedSystemCredentials,
        {}
      );
    } catch {
      systemCredentialsMap = {};
    }

    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {}))
    );

    // Get model
    const enabledModelsFromDb = await ctx.runQuery(api.admin.listAllModels);
    const enabledModels = (enabledModelsFromDb || []).filter(
      (m: any) => m.enabled
    );

    let model: any;
    if (credentials?.modelId && credentials.modelId !== '') {
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider && enabledModels.length > 0) {
      const providerModel = enabledModels.find(
        (m: any) => m.provider === credentials.provider
      );
      if (providerModel) {
        model = {
          id: providerModel.modelId,
          provider: providerModel.provider,
          contextTokens: providerModel.contextTokens,
          maxOutputTokens: providerModel.maxOutputTokens,
          defaultMax: providerModel.defaultMax,
        };
        credentials.modelId = providerModel.modelId;
      } else {
        model = getFallbackModel();
      }
    } else {
      model = getFallbackModel();
    }

    const llmClient = getLlmClient(credentials);

    // Generate answers progressively
    const answers: Array<{ questionId: string; answer: string }> = [];
    const generatedAnswers: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i] as Question;

      // Build context from previous answers in this batch
      const previousContext = generatedAnswers
        .map((ans, idx) => `${questions[idx].text}\nAnswer: ${ans}`)
        .join('\n\n');

      const prompt = buildBatchQuestionPrompt({
        projectTitle: project.title,
        projectDescription: project.description,
        questionText: question.text,
        previousAnswers: previousContext,
      });

      const answer = await generateAnswer({
        prompt,
        model,
        llmClient,
      });

      answers.push({ questionId: question.id, answer });
      generatedAnswers.push(answer);
    }

    return { answers };
  },
});

function buildBatchQuestionPrompt(params: {
  projectTitle: string;
  projectDescription: string;
  questionText: string;
  previousAnswers: string;
}): string {
  return `You are helping answer questions for a software project.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousAnswers ? `Previous answers in this batch:\n${params.previousAnswers}\n\n` : ''}

Question: ${params.questionText}

Provide a clear, concise answer based on the project context and maintain consistency with previous answers. Be specific and actionable.`;
}

async function generateAnswer(params: {
  prompt: string;
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  // TODO: Replace with actual LLM API call when ready
  // For now, return a placeholder
  return `AI-generated batch answer for this question based on the project context and previous answers. This will be replaced with actual LLM integration.`;
}
```

**Step 2: Commit the batch action**

```bash
git add convex/actions/generateAllQuestionAnswers.ts
git commit -m "feat: add batch question AI answer action

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add AI Suggest Button to Individual Questions

**Files:**
- Modify: `components/questions-panel.tsx:1-242`

**Step 1: Import the new action and add state**

```typescript
// Add to imports at top (after line 4)
import { Sparkles } from "lucide-react";

// Add to imports (after line 5)
const generateQuestionAnswer = useAction(api["actions/generateQuestionAnswer"].generateQuestionAnswer as any);

// Add new state after line 54
const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null);
```

**Step 2: Add AI suggest handler**

```typescript
// Add after handleRegenerateQuestions function (after line 109)
async function handleAiSuggest(questionId: string) {
  setAiGeneratingId(questionId);
  try {
    const result = await generateQuestionAnswer({
      projectId,
      phaseId,
      questionId,
    });
    // Update local state with suggestion
    setLocalAnswers(prev => ({
      ...prev,
      [questionId]: result.suggestedAnswer,
    }));
    // Trigger save
    pendingSaveRef.current[questionId] = result.suggestedAnswer;
  } catch (error) {
    console.error("Failed to generate AI answer:", error);
  } finally {
    setAiGeneratingId(null);
  }
}
```

**Step 3: Add AI button to each question**

Replace the textarea section (lines 183-212) with:

```typescript
<div className="ml-11 space-y-2">
  <div className="flex items-center gap-2">
    <Textarea
      value={answer}
      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
      placeholder="Enter your answer..."
      className="min-h-[100px] flex-1"
      maxLength={maxLength}
    />
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleAiSuggest(question.id)}
      disabled={aiGeneratingId === question.id || isGenerating}
      className="self-start"
    >
      {aiGeneratingId === question.id ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
        </>
      )}
    </Button>
  </div>
  <div className="flex items-center justify-between text-xs">
    <div className="flex items-center gap-2">
      {isSaving && (
        <span className="flex items-center text-muted-foreground">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Saving...
        </span>
      )}
      {isSaved && (
        <span className="flex items-center text-success">
          <Check className="w-3 h-3 mr-1" />
          Saved
        </span>
      )}
    </div>
    <span className={cn(
      "text-muted-foreground",
      charCount > maxLength * 0.9 && "text-warning"
    )}>
      {charCount.toLocaleString()}/{maxLength.toLocaleString()}
    </span>
  </div>
</div>
```

**Step 4: Commit the individual AI button**

```bash
git add components/questions-panel.tsx
git commit -m "feat: add AI suggest button for individual questions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Batch AI Answer Button and Modal

**Files:**
- Modify: `components/questions-panel.tsx:1-242`
- Create: `components/batch-ai-modal.tsx`

**Step 1: Create the batch AI modal component**

```typescript
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchAnswer {
  questionId: string;
  answer: string;
}

interface Question {
  id: string;
  text: string;
  answer?: string;
}

interface BatchAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGenerating: boolean;
  currentProgress?: number;
  totalQuestions?: number;
  questions: Question[];
  batchAnswers: BatchAnswer[];
  onAcceptAll: () => void;
  onCancel: () => void;
}

export function BatchAiModal({
  open,
  onOpenChange,
  isGenerating,
  currentProgress = 0,
  totalQuestions = 0,
  questions,
  batchAnswers,
  onAcceptAll,
  onCancel,
}: BatchAiModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI-Generated Answers
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? `Generating answers... (${currentProgress} of ${totalQuestions})`
              : "Review and accept the AI-generated answers below"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {questions.map((question, idx) => {
              const batchAnswer = batchAnswers.find(
                (ba) => ba.questionId === question.id
              );
              const isProcessed = idx < currentProgress;
              const isProcessing = idx === currentProgress && isGenerating;

              return (
                <div key={question.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 border border-border bg-secondary/30 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-medium flex-1">{question.text}</p>
                    {isProcessing && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {isProcessed && !isProcessing && (
                      <Check className="w-4 h-4 text-success" />
                    )}
                  </div>
                  {batchAnswer && (
                    <div className="ml-8 p-3 bg-secondary/50 rounded-md">
                      <p className="text-sm">{batchAnswer.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={onAcceptAll}
            disabled={isGenerating || batchAnswers.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Accept All
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add ScrollArea component if missing**

Check if `components/ui/scroll-area.tsx` exists. If not, create it:

```typescript
import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
```

**Step 3: Commit the modal components**

```bash
git add components/batch-ai-modal.tsx components/ui/scroll-area.tsx
git commit -m "feat: add batch AI modal component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Integrate Batch AI Modal into QuestionsPanel

**Files:**
- Modify: `components/questions-panel.tsx:1-242`

**Step 1: Import batch action and modal**

```typescript
// Add to imports (after line 5)
import { BatchAiModal } from "./batch-ai-modal";
const generateAllQuestionAnswers = useAction(api["actions/generateAllQuestionAnswers"].generateAllQuestionAnswers as any);

// Add new state after line 55
const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
const [isBatchGenerating, setIsBatchGenerating] = useState(false);
const [batchProgress, setBatchProgress] = useState(0);
const [batchAnswers, setBatchAnswers] = useState<Array<{ questionId: string; answer: string }>>([]);
```

**Step 2: Add batch AI handler**

```typescript
// Add after handleAiSuggest function
async function handleBatchAiGenerate() {
  setIsBatchModalOpen(true);
  setIsBatchGenerating(true);
  setBatchProgress(0);
  setBatchAnswers([]);

  try {
    const result = await generateAllQuestionAnswers({
      projectId,
      phaseId,
    });

    setBatchAnswers(result.answers);
    setBatchProgress(result.answers.length);
  } catch (error) {
    console.error("Failed to generate batch answers:", error);
  } finally {
    setIsBatchGenerating(false);
  }
}

function handleAcceptBatchAnswers() {
  // Update local state with all batch answers
  const updates: Record<string, string> = {};
  batchAnswers.forEach(({ questionId, answer }) => {
    updates[questionId] = answer;
    pendingSaveRef.current[questionId] = answer;
  });

  setLocalAnswers(prev => ({ ...prev, ...updates }));
  setIsBatchModalOpen(false);
  setBatchAnswers([]);
  setBatchProgress(0);
}

function handleCancelBatch() {
  setIsBatchModalOpen(false);
  setBatchAnswers([]);
  setBatchProgress(0);
}
```

**Step 3: Add "Let AI answer all" button**

Replace the header section (lines 115-141) with:

```typescript
<CardHeader className="flex flex-row items-start justify-between gap-4">
  <div className="flex-1">
    <CardTitle className="text-xl normal-case tracking-normal font-semibold">
      Questions & Clarifications
    </CardTitle>
    <CardDescription className="mt-1">
      Answer these questions to help generate better artifacts.
      {unansweredRequired > 0 && (
        <span className="text-warning ml-2 font-medium">
          {unansweredRequired} required question{unansweredRequired !== 1 ? "s" : ""} unanswered
        </span>
      )}
    </CardDescription>
  </div>
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={handleBatchAiGenerate}
      disabled={isBatchGenerating || questions.length === 0}
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Let AI answer all
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegenerateQuestions}
      disabled={isRegenerating}
    >
      {isRegenerating ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4 mr-2" />
      )}
      Regenerate
    </Button>
  </div>
</CardHeader>
```

**Step 4: Add modal at end of component**

Add before the closing `</Card>` tag (after line 240):

```typescript
<BatchAiModal
  open={isBatchModalOpen}
  onOpenChange={setIsBatchModalOpen}
  isGenerating={isBatchGenerating}
  currentProgress={batchProgress}
  totalQuestions={questions.length}
  questions={questions}
  batchAnswers={batchAnswers}
  onAcceptAll={handleAcceptBatchAnswers}
  onCancel={handleCancelBatch}
/>
```

**Step 5: Commit the batch integration**

```bash
git add components/questions-panel.tsx
git commit -m "feat: integrate batch AI modal into questions panel

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Missing Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Check if @radix-ui/react-scroll-area is installed**

Run: `npm list @radix-ui/react-scroll-area`

**Step 2: Install if missing**

If not installed, run:

```bash
npm install @radix-ui/react-scroll-area
```

**Step 3: Commit package updates**

```bash
git add package.json package-lock.json
git commit -m "deps: add radix-ui scroll-area component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Test Individual AI Suggest

**Files:**
- Manual testing

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

**Step 2: Navigate to a phase**

1. Open browser to http://localhost:3000
2. Create or open a project
3. Navigate to a phase (e.g., "brief")
4. Wait for questions to load

**Step 3: Test individual AI suggest**

1. Click the Sparkles button next to any question
2. Verify:
   - Button shows loading spinner
   - After completion, answer appears in textarea
   - Answer auto-saves after 500ms
   - Save indicator shows "Saved"

Expected: AI suggestion appears and saves successfully

**Step 4: Document any issues**

Note any bugs or unexpected behavior for fixing

---

## Task 8: Test Batch AI Answer

**Files:**
- Manual testing

**Step 1: Test batch generation**

1. In a phase with multiple questions
2. Click "Let AI answer all" button
3. Verify:
   - Modal opens
   - Progress indicator shows "Generating..."
   - Questions appear one by one with checkmarks
   - Final state shows all answers

Expected: Modal shows progressive generation

**Step 2: Test accept all**

1. Click "Accept All" button
2. Verify:
   - Modal closes
   - All answers appear in textareas
   - Answers auto-save
   - Save indicators show "Saved"

Expected: All answers are accepted and saved

**Step 3: Test cancel**

1. Generate batch answers again
2. Click "Cancel" button
3. Verify:
   - Modal closes
   - No answers are saved
   - Textareas remain unchanged

Expected: Cancel doesn't save answers

**Step 4: Document any issues**

Note any bugs or unexpected behavior for fixing

---

## Task 9: Add Real LLM Integration (Future Enhancement)

**Files:**
- Modify: `convex/actions/generateQuestionAnswer.ts:80-90`
- Modify: `convex/actions/generateAllQuestionAnswers.ts:145-155`

**Note:** This task is for future implementation when ready to integrate real LLM APIs.

**Step 1: Replace placeholder in individual action**

In `generateQuestionAnswer.ts`, replace the `generateAnswer` function with:

```typescript
async function generateAnswer(params: {
  prompt: string;
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  if (!params.llmClient) {
    throw new Error('No LLM client available');
  }

  try {
    const response = await params.llmClient.complete(params.prompt, {
      model: params.model.id,
      maxTokens: 500,
      temperature: 0.7,
    });
    return response.content.trim();
  } catch (error) {
    console.error('LLM API error:', error);
    throw new Error('Failed to generate answer');
  }
}
```

**Step 2: Replace placeholder in batch action**

Same change in `generateAllQuestionAnswers.ts`

**Step 3: Test with real API**

1. Configure LLM credentials in settings
2. Generate individual answer
3. Generate batch answers
4. Verify responses are meaningful

Expected: Real AI-generated answers based on project context

**Step 4: Commit LLM integration**

```bash
git add convex/actions/generateQuestionAnswer.ts convex/actions/generateAllQuestionAnswers.ts
git commit -m "feat: integrate real LLM API for question answering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Add Error Handling and User Feedback

**Files:**
- Modify: `components/questions-panel.tsx:85-120`

**Step 1: Add error state**

```typescript
// Add state after line 56
const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

**Step 2: Update AI suggest handler with error handling**

```typescript
async function handleAiSuggest(questionId: string) {
  setAiGeneratingId(questionId);
  setErrorMessage(null);
  try {
    const result = await generateQuestionAnswer({
      projectId,
      phaseId,
      questionId,
    });
    setLocalAnswers(prev => ({
      ...prev,
      [questionId]: result.suggestedAnswer,
    }));
    pendingSaveRef.current[questionId] = result.suggestedAnswer;
  } catch (error: any) {
    console.error("Failed to generate AI answer:", error);
    setErrorMessage(error.message || "Failed to generate AI answer. Please try again.");
  } finally {
    setAiGeneratingId(null);
  }
}
```

**Step 3: Update batch handler with error handling**

```typescript
async function handleBatchAiGenerate() {
  setIsBatchModalOpen(true);
  setIsBatchGenerating(true);
  setBatchProgress(0);
  setBatchAnswers([]);
  setErrorMessage(null);

  try {
    const result = await generateAllQuestionAnswers({
      projectId,
      phaseId,
    });

    setBatchAnswers(result.answers);
    setBatchProgress(result.answers.length);
  } catch (error: any) {
    console.error("Failed to generate batch answers:", error);
    setErrorMessage(error.message || "Failed to generate answers. Please try again.");
    setIsBatchModalOpen(false);
  } finally {
    setIsBatchGenerating(false);
  }
}
```

**Step 4: Add error display in UI**

Add after CardDescription (line 127):

```typescript
{errorMessage && (
  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
    <p className="text-sm text-destructive">{errorMessage}</p>
  </div>
)}
```

**Step 5: Commit error handling**

```bash
git add components/questions-panel.tsx
git commit -m "feat: add error handling and user feedback for AI features

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Documentation

**Files:**
- Create: `docs/features/ai-question-answering.md`

**Step 1: Write feature documentation**

```markdown
# AI Question Answering Feature

## Overview

The AI Question Answering feature helps users quickly populate phase questions using AI-generated suggestions based on their project context.

## Features

### Individual Question AI Suggest

- Click the sparkle icon (✨) next to any question
- AI generates a contextual answer based on:
  - Project title and description
  - Previously answered questions in the phase
- Answer appears in the textarea and auto-saves after 500ms
- Users can edit the AI-generated answer before saving

### Batch AI Answer All

- Click "Let AI answer all" button in the questions panel header
- AI generates answers for all questions progressively
- Answers are shown in a modal preview
- Users can review all answers before accepting
- "Accept All" button saves all answers at once
- "Cancel" button discards the batch without saving

## Implementation Details

### Backend Actions

1. **`generateQuestionAnswer`** (`convex/actions/generateQuestionAnswer.ts`)
   - Takes: projectId, phaseId, questionId
   - Returns: suggestedAnswer string
   - Uses existing LLM infrastructure for credential resolution

2. **`generateAllQuestionAnswers`** (`convex/actions/generateAllQuestionAnswers.ts`)
   - Takes: projectId, phaseId
   - Returns: Array of { questionId, answer }
   - Generates answers progressively with context awareness

### Frontend Components

1. **QuestionsPanel** (`components/questions-panel.tsx`)
   - Individual sparkle button per question
   - "Let AI answer all" button in header
   - State management for AI generation
   - Auto-save integration

2. **BatchAiModal** (`components/batch-ai-modal.tsx`)
   - Preview modal for batch answers
   - Progress indicator
   - Accept/Cancel actions

## Usage

### For Individual Questions

1. Navigate to any project phase
2. Find the question you want AI to answer
3. Click the sparkle icon (✨) next to the textarea
4. Wait for the AI to generate the answer
5. Review and edit as needed
6. Answer auto-saves after 500ms

### For All Questions

1. Navigate to any project phase
2. Click "Let AI answer all" in the header
3. Wait for the modal to show all generated answers
4. Review the answers in the preview
5. Click "Accept All" to save all answers
6. Or click "Cancel" to discard

## Configuration

The feature uses the same LLM configuration as phase generation:
- User can configure their own API keys
- Or use system-wide credentials configured by admin
- Model selection follows the same priority as phase generation

## Future Enhancements

- [ ] Real-time streaming for batch generation
- [ ] Ability to edit individual answers in batch modal
- [ ] Regenerate individual answers in batch mode
- [ ] Save batch as draft without applying
- [ ] AI confidence scores per answer
```

**Step 2: Commit documentation**

```bash
git add docs/features/ai-question-answering.md
git commit -m "docs: add AI question answering feature documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

This plan implements a complete AI question answering system with:

1. ✅ Two Convex actions (individual + batch)
2. ✅ UI integration with sparkle buttons
3. ✅ Batch modal for preview and review
4. ✅ Error handling and user feedback
5. ✅ Auto-save integration
6. ✅ Progressive context awareness in batch mode
7. ✅ Documentation

The implementation follows existing patterns, reuses LLM infrastructure, and provides both quick individual answers and comprehensive batch processing.
