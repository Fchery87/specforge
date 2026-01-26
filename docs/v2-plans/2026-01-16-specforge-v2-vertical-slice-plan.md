# SpecForge v2.0 — Vertical Slice Implementation Plan

**Version:** 1.0  
**Date:** January 16, 2026  
**Author:** SpecForge Engineering  
**Status:** Ready for Implementation  
**Based On:** PRD | Architecture | PRP  

> **Implementation note (Jan 2026):** This repo now has an end-to-end vertical slice for live generation:
> - Artifacts support `streamStatus`, `currentSection`, `sectionsCompleted`, `sectionsTotal`, and incremental persistence.
> - The UI shows a live preview fed by `api.artifacts.getArtifactByPhase`.
> - Cancel stops generation and preserves partial output (`streamStatus='cancelled'`).

---

## 1. Executive Summary

### 1.1 Chosen Vertical Slice

**Feature:** Real-Time Streaming Generation  
**Rationale:** P0 priority, on critical path for all other features, highest user-facing impact

### 1.2 Slice Scope

| Layer | Components | Lines of Code Est. |
| ----- | ---------- | ------------------ |
| **Database** | Schema migration, streaming fields | ~50 |
| **Backend** | `appendPartialContent` mutation, worker modifications | ~200 |
| **Frontend** | `StreamingArtifact`, `SectionProgress`, cancel UI | ~400 |
| **Integration** | LLM streaming adapters (7 providers) | ~300 |
| **Total** | | ~950 |

### 1.3 Timeline

| Phase | Duration | Deliverables |
| ----- | -------- | ------------ |
| **Phase 1: Schema & Backend Foundation** | Day 1-2 | Database schema, streaming mutations |
| **Phase 2: Frontend Components** | Day 3-4 | Streaming UI, progress indicators |
| **Phase 3: Integration & Testing** | Day 5-6 | Provider adapters, E2E testing |
| **Phase 4: Polish & Validation** | Day 7 | Performance tuning, edge cases |

---

## 2. Database Layer Implementation

### 2.1 Schema Changes Required

```typescript
// convex/schema.ts additions

// MODIFY: artifacts table - add streaming fields
artifacts: defineTable({
  // ... existing fields ...
  // NEW v2.0 streaming fields
  streamStatus: v.optional(
    v.union(
      v.literal('idle'),
      v.literal('streaming'),
      v.literal('paused'),
      v.literal('complete'),
      v.literal('cancelled')
    )
  ),
  currentSection: v.optional(v.string()),
  sectionsCompleted: v.optional(v.number()),
  sectionsTotal: v.optional(v.number()),
  tokensGenerated: v.optional(v.number()),
  currentVersionNumber: v.optional(v.number()),
})

// NEW: artifactVersions table for history
artifactVersions: defineTable({
  artifactId: v.id('artifacts'),
  version: v.number(),
  content: v.string(),
  previewHtml: v.string(),
  changeType: v.union(
    v.literal('generated'),
    v.literal('regenerated'),
    v.literal('edited'),
    v.literal('restored'),
    v.literal('section_regen')
  ),
  changeSummary: v.optional(v.string()),
  changedBy: v.string(),
  createdAt: v.number(),
  sections: v.array(
    v.object({
      name: v.string(),
      tokens: v.number(),
      model: v.string(),
    })
  ),
})
  .index('by_artifact', ['artifactId'])
  .index('by_artifact_version', ['artifactId', 'version'])

// NEW: telemetryEvents table
telemetryEvents: defineTable({
  eventType: v.union(
    v.literal('generation_start'),
    v.literal('generation_complete'),
    v.literal('generation_error'),
    v.literal('export_created'),
    v.literal('project_created'),
    v.literal('phase_completed')
  ),
  userId: v.optional(v.string()),
  projectId: v.optional(v.id('projects')),
  phaseId: v.optional(v.string()),
  provider: v.optional(v.string()),
  modelId: v.optional(v.string()),
  duration: v.optional(v.number()),
  tokensUsed: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  errorCategory: v.optional(v.string()),
  metadata: v.optional(v.any()),
  timestamp: v.number(),
})
  .index('by_type', ['eventType'])
  .index('by_timestamp', ['timestamp'])
```

### 2.2 Migration Script

```typescript
// convex/migrations/v2_streaming_migration.ts

export const migrateStreamingFields = internalMutation({
  handler: async (ctx) => {
    // 1. Add streaming fields to existing artifacts
    const artifacts = await ctx.db.query('artifacts').collect();
    for (const artifact of artifacts) {
      await ctx.db.patch(artifact._id, {
        streamStatus: 'complete',
        currentVersionNumber: 1,
        tokensGenerated: artifact.sections?.reduce((sum, s) => sum + s.tokens, 0) ?? 0,
      });
    }

    // 2. Create initial version for each artifact
    for (const artifact of artifacts) {
      const existingVersion = await ctx.db
        .query('artifactVersions')
        .withIndex('by_artifact', (q) => q.eq('artifactId', artifact._id))
        .first();

      if (!existingVersion) {
        await ctx.db.insert('artifactVersions', {
          artifactId: artifact._id,
          version: 1,
          content: artifact.content,
          previewHtml: artifact.previewHtml,
          changeType: 'generated',
          changedBy: 'system',
          createdAt: artifact._creationTime,
          sections: artifact.sections ?? [],
        });
      }
    }

    // 3. Seed system templates (S3 task, but required for demo)
    await seedSystemTemplates(ctx);
  },
});
```

### 2.3 Migration Execution

```bash
# Deploy schema changes
npx convex dev --once --run 'migrateStreamingFields()'

# Verify migration
npx convex dashboard  # Check new tables exist
```

---

## 3. Backend Layer Implementation

### 3.1 New Internal Mutation: appendPartialContent

```typescript
// convex/internal.ts additions

export const appendPartialContent = internalMutation({
  args: {
    artifactId: v.id('artifacts'),
    content: v.string(),
    tokensGenerated: v.number(),
    sectionName: v.optional(v.string()),
    sectionIndex: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) {
      throw new ConvexError('Artifact not found');
    }

    // Calculate progress
    const sectionsTotal = artifact.sectionsTotal ?? artifact.sections?.length ?? 1;
    const sectionsCompleted = args.isComplete
      ? (args.sectionIndex ?? 0) + 1
      : artifact.sectionsCompleted ?? 0;

    // Update artifact with streaming status
    await ctx.db.patch(args.artifactId, {
      content: args.content,
      streamStatus: args.isComplete ? 'complete' : 'streaming',
      currentSection: args.sectionName,
      sectionsCompleted,
      sectionsTotal,
      tokensGenerated: args.tokensGenerated,
      currentVersionNumber: (artifact.currentVersionNumber ?? 1),
    });

    // Create version snapshot on section completion
    if (args.isComplete && args.sectionIndex !== undefined) {
      await createSectionVersion(ctx, args.artifactId, args.content, args.sectionName!, args.tokensGenerated);
    }

    // Log telemetry
    await logTelemetryEvent(ctx, {
      eventType: 'generation_streaming',
      projectId: artifact.projectId,
      phaseId: artifact.phaseId,
      metadata: {
        tokensGenerated: args.tokensGenerated,
        sectionComplete: args.isComplete,
      },
    });
  },
});

async function createSectionVersion(
  ctx: MutationCtx,
  artifactId: Id<'artifacts'>,
  content: string,
  sectionName: string,
  tokens: number
) {
  const artifact = await ctx.db.get(artifactId);
  if (!artifact) return;

  const versionNumber = (artifact.currentVersionNumber ?? 1) + 1;
  
  await ctx.db.insert('artifactVersions', {
    artifactId,
    version: versionNumber,
    content,
    previewHtml: await renderMarkdown(content),
    changeType: 'section_regen',
    changedBy: 'system',
    createdAt: Date.now(),
    sections: [
      ...(artifact.sections ?? []),
      { name: sectionName, tokens, model: 'current-model' },
    ],
  });

  await ctx.db.patch(artifactId, { currentVersionNumber: versionNumber });
}
```

### 3.2 Modified Worker: generatePhaseWorker Streaming

```typescript
// convex/internalActions.ts modifications

export const generatePhaseWorker = internalAction({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    plan: v.any(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
    const phase = await ctx.runQuery(api.phases.getPhase, { 
      projectId: args.projectId, 
      phaseId: args.phaseId 
    });

    // Get user LLM config
    const userConfig = await getUserLlmConfig(ctx, project.userId);
    const client = createLlmClient(userConfig);
    const model = userConfig.defaultModel;

    // Update artifact to streaming
    const artifactId = await initializeStreamingArtifact(ctx, args.projectId, args.phaseId);

    let fullContent = '';
    let tokensGenerated = 0;
    const sections = [];

    // Generate each section with streaming
    for (let sectionIndex = 0; sectionIndex < args.plan.sections.length; sectionIndex++) {
      const section = args.plan.sections[sectionIndex];
      
      // Stream this section
      const sectionStream = streamSection(client, section.prompt, model);
      
      let sectionContent = '';
      let sectionTokens = 0;

      for await (const chunk of sectionStream) {
        sectionContent += chunk.content;
        sectionTokens += chunk.tokens;
        
        // Flush every 50 tokens (or on final chunk)
        if (sectionTokens % 50 === 0 || chunk.done) {
          fullContent += sectionContent;
          tokensGenerated += sectionTokens;
          
          await ctx.runMutation(internal.internal.appendPartialContent, {
            artifactId,
            content: fullContent,
            tokensGenerated,
            sectionName: section.name,
            sectionIndex,
            isComplete: chunk.done,
          });

          // Small delay to allow UI updates
          await sleep(50);
        }
      }

      sections.push({
        name: section.name,
        tokens: sectionTokens,
        model,
      });
    }

    // Mark as complete
    await ctx.runMutation(internal.internal.appendPartialContent, {
      artifactId,
      content: fullContent,
      tokensGenerated,
      isComplete: true,
    });

    // Final version snapshot
    await createFinalVersion(ctx, artifactId, fullContent, sections);

    // Log completion
    await logTelemetryEvent(ctx, {
      eventType: 'generation_complete',
      projectId: args.projectId,
      phaseId: args.phaseId,
      provider: userConfig.provider,
      modelId: model,
      duration: Date.now() - startTime,
      tokensUsed: tokensGenerated,
    });
  },
});

async function* streamSection(
  client: LlmClient,
  prompt: string,
  model: string
): AsyncIterable<{ content: string; tokens: number; done: boolean }> {
  const response = await client.complete(prompt, {
    model,
    maxTokens: 4000,
    temperature: 0.7,
  });

  // Simulate streaming if provider doesn't support it
  const words = response.content.split(' ');
  let accumulated = '';

  for (let i = 0; i < words.length; i++) {
    accumulated += (i > 0 ? ' ' : '') + words[i];
    yield {
      content: words[i] + ' ',
      tokens: countTokens(words[i] + ' '),
      done: i === words.length - 1,
    };
  }
}
```

### 3.3 New Telemetry Logging

```typescript
// convex/internal.ts

export const logTelemetryEvent = internalMutation({
  args: {
    eventType: v.string(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    phaseId: v.optional(v.string()),
    provider: v.optional(v.string()),
    modelId: v.optional(v.string()),
    duration: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCategory: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('telemetryEvents', {
      ...args,
      eventType: args.eventType as any,
      timestamp: Date.now(),
    });
  },
});
```

### 3.4 Cancel Generation Handler

```typescript
// convex/actions/cancelGeneration.ts

export const cancelGeneration = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find in-progress generation tasks
    const tasks = await ctx.runQuery(api.generationTasks.getInProgress, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });

    for (const task of tasks) {
      // Mark task as cancelled
      await ctx.runMutation(internal.mutations.generationTasks.update, {
        id: task._id,
        status: 'cancelled',
      });

      // Update artifact status
      const artifact = await ctx.runQuery(api.artifacts.getByPhase, {
        projectId: args.projectId,
        phaseId: task.phaseId,
      });

      if (artifact) {
        await ctx.runMutation(internal.internal.updateArtifactStatus, {
          artifactId: artifact._id,
          status: 'cancelled',
        });
      }

      // Log cancellation
      await logTelemetryEvent(ctx, {
        eventType: 'generation_cancelled',
        projectId: args.projectId,
        phaseId: task.phaseId,
        metadata: { taskId: task._id },
      });
    }

    return { success: true, cancelledTasks: tasks.length };
  },
});
```

---

## 4. Frontend Layer Implementation

### 4.1 StreamingArtifact Component

```tsx
// components/streaming/StreamingArtifact.tsx

'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SectionProgress } from './SectionProgress';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { CancelButton } from './CancelButton';
import { StreamingStatus } from './StreamingStatus';

interface StreamingArtifactProps {
  projectId: string;
  phaseId: string;
  artifactId: string;
  onComplete?: () => void;
}

export function StreamingArtifact({
  projectId,
  phaseId,
  artifactId,
  onComplete,
}: StreamingArtifactProps) {
  // Reactive subscription to artifact updates
  const artifact = useQuery(api.artifacts.getById, { artifactId });
  const cancelMutation = useMutation(api.actions.cancelGeneration);
  const [isCancelling, setIsCancelling] = useState(false);

  // Auto-scroll to bottom as content streams in
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [artifact?.content]);

  // Handle cancellation
  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      await cancelMutation({ projectId, phaseId });
    } finally {
      setIsCancelling(false);
    }
  }, [cancelMutation, projectId, phaseId]);

  // Handle completion
  useEffect(() => {
    if (artifact?.streamStatus === 'complete' && onComplete) {
      onComplete();
    }
  }, [artifact?.streamStatus, onComplete]);

  if (!artifact) {
    return <div className="animate-pulse">Loading artifact...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <StreamingStatus
          status={artifact.streamStatus}
          tokensGenerated={artifact.tokensGenerated}
        />
        {(artifact.streamStatus === 'streaming' || isCancelling) && (
          <CancelButton
            onClick={handleCancel}
            disabled={isCancelling}
          />
        )}
      </div>

      {/* Section Progress */}
      {artifact.streamStatus === 'streaming' && (
        <SectionProgress
          currentSection={artifact.currentSection}
          sectionsCompleted={artifact.sectionsCompleted ?? 0}
          sectionsTotal={artifact.sectionsTotal ?? 1}
          estimatedTimeRemaining={artifact.estimatedTimeRemaining}
        />
      )}

      {/* Markdown Content with Live Updates */}
      <div
        ref={contentRef}
        className="prose prose-sm max-w-none max-h-[600px] overflow-y-auto"
      >
        <MarkdownPreview content={artifact.content} />
        {artifact.streamStatus === 'streaming' && (
          <span className="animate-pulse inline-block w-2 h-4 ml-1 bg-blue-500" />
        )}
      </div>
    </div>
  );
}
```

### 4.2 SectionProgress Component

```tsx
// components/streaming/SectionProgress.tsx

interface SectionProgressProps {
  currentSection?: string;
  sectionsCompleted: number;
  sectionsTotal: number;
  estimatedTimeRemaining?: number;
}

export function SectionProgress({
  currentSection,
  sectionsCompleted,
  sectionsTotal,
  estimatedTimeRemaining,
}: SectionProgressProps) {
  const percentage = Math.round((sectionsCompleted / sectionsTotal) * 100);
  const minutesLeft = estimatedTimeRemaining
    ? Math.ceil(estimatedTimeRemaining / 60)
    : null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Section {sectionsCompleted + 1} of {sectionsTotal}
          {currentSection && `: ${currentSection}`}
        </span>
        <span className="text-sm text-slate-500">
          {percentage}% complete
          {minutesLeft && ` · ~${minutesLeft} min remaining`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Section Indicators */}
      <div className="flex gap-1 mt-3">
        {Array.from({ length: sectionsTotal }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-sm ${
              i < sectionsCompleted
                ? 'bg-green-500'
                : i === sectionsCompleted
                ? 'bg-blue-500 animate-pulse'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

### 4.3 StreamingStatus Component

```tsx
// components/streaming/StreamingStatus.tsx

import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

type StreamStatus = 'idle' | 'streaming' | 'paused' | 'complete' | 'cancelled' | 'error';

interface StreamingStatusProps {
  status?: StreamStatus;
  tokensGenerated?: number;
}

export function StreamingStatus({ status, tokensGenerated }: StreamingStatusProps) {
  const config = {
    idle: { icon: null, text: 'Ready', color: 'text-slate-500' },
    streaming: { icon: Loader2, text: 'Generating...', color: 'text-blue-500', animate: true },
    paused: { icon: Loader2, text: 'Paused', color: 'text-yellow-500' },
    complete: { icon: CheckCircle2, text: 'Complete', color: 'text-green-500' },
    cancelled: { icon: XCircle, text: 'Cancelled', color: 'text-orange-500' },
    error: { icon: AlertCircle, text: 'Error', color: 'text-red-500' },
  };

  const { icon: Icon, text, color, animate } = config[status ?? 'idle'];

  return (
    <div className="flex items-center gap-2">
      {Icon && (
        <Icon className={`w-4 h-4 ${color} ${animate ? 'animate-spin' : ''}`} />
      )}
      <span className={`text-sm font-medium ${color}`}>{text}</span>
      {tokensGenerated !== undefined && status === 'streaming' && (
        <span className="text-xs text-slate-400">
          {tokensGenerated.toLocaleString()} tokens
        </span>
      )}
    </div>
  );
}
```

### 4.4 CancelButton Component

```tsx
// components/streaming/CancelButton.tsx

import { useState } from 'react';
import { X } from 'lucide-react';

interface CancelButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function CancelButton({ onClick, disabled }: CancelButtonProps) {
  const [confirmShow, setConfirmShow] = useState(false);

  if (confirmShow) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onClick}
          disabled={disabled}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Confirm Cancel
        </button>
        <button
          onClick={() => setConfirmShow(false)}
          className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
        >
          Resume
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmShow(true)}
      disabled={disabled}
      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
    >
      <X className="w-4 h-4" />
      Cancel
    </button>
  );
}
```

### 4.5 Phase Page Integration

```tsx
// app/project/[id]/phase/[phaseId]/page.tsx modifications

import { StreamingArtifact } from '@/components/streaming/StreamingArtifact';

export default function PhasePage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>;
}) {
  const resolvedParams = use(params);
  const { id: projectId, phaseId } = resolvedParams;
  
  const artifact = useQuery(api.artifacts.getByPhase, {
    projectId,
    phaseId,
  });

  const startGeneration = useMutation(api.actions.generatePhase);

  if (!artifact) {
    return <div>Loading...</div>;
  }

  if (artifact.streamStatus === 'idle' || artifact.streamStatus === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-4">Ready to generate</h2>
        <button
          onClick={() => startGeneration({ projectId, phaseId })}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Generate {phaseId}
        </button>
      </div>
    );
  }

  return (
    <StreamingArtifact
      projectId={projectId}
      phaseId={phaseId}
      artifactId={artifact._id}
      onComplete={() => {
        // Navigate to next phase or show completion
      }}
    />
  );
}
```

---

## 5. LLM Provider Streaming Integration

### 5.1 Provider Streaming Support Matrix

| Provider | Native Streaming | Fallback Required | Notes |
| -------- | ---------------- | ----------------- | ----- |
| OpenAI | ✅ | No | Use `stream: true` param |
| Anthropic | ✅ | No | Use Claude SDK streaming |
| DeepSeek | ✅ | No | SSE streaming supported |
| Mistral | ✅ | No | Streaming endpoint available |
| Z.AI | ❌ | Yes | Batch only, simulate |
| Minimax | ❌ | Yes | Batch only, simulate |
| Google | ✅ | No | Vertex AI streaming |

### 5.2 OpenAI Streaming Implementation

```typescript
// lib/llm/providers/openai.ts

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function* streamOpenAI(
  model: string,
  prompt: string,
  options: CompletionOptions
): AsyncIterable<string> {
  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
```

### 5.3 Fallback Streaming Simulation

```typescript
// lib/llm/streaming.ts

export async function* simulateStreaming(
  content: string,
  tokensPerChunk: number = 10
): AsyncIterable<string> {
  const tokens = tokenize(content);
  
  for (let i = 0; i < tokens.length; i += tokensPerChunk) {
    const chunk = tokens.slice(i, i + tokensPerChunk).join('');
    yield chunk;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Tokenizer (simplified - use proper tokenizer in production)
function tokenize(text: string): string[] {
  return text.split(/\s+/);
}
```

### 5.4 Unified Streaming Interface

```typescript
// lib/llm/streaming.ts

import { streamOpenAI } from './providers/openai';
import { streamAnthropic } from './providers/anthropic';
import { streamDeepSeek } from './providers/deepseek';

type StreamHandler = (prompt: string, options: CompletionOptions) => AsyncIterable<string>;

const STREAM_PROVIDERS: Record<string, StreamHandler> = {
  openai: streamOpenAI,
  anthropic: streamAnthropic,
  deepseek: streamDeepSeek,
};

const FALLBACK_PROVIDERS = ['zai', 'minimax'];

export async function* streamCompletion(
  provider: string,
  model: string,
  prompt: string,
  options: CompletionOptions
): AsyncIterable<string> {
  const handler = STREAM_PROVIDERS[provider];
  
  if (handler) {
    yield* handler(prompt, options);
  } else if (FALLBACK_PROVIDERS.includes(provider)) {
    // Fallback: get full response then simulate streaming
    const response = await getCompletion(provider, model, prompt, options);
    yield* simulateStreaming(response);
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// convex/__tests__/streaming.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendPartialContent } from '../internal';

describe('Streaming Mutations', () => {
  it('updates artifact content incrementally', async () => {
    const ctx = createMockCtx();
    const artifact = createMockArtifact({ content: 'Part 1' });
    
    await appendPartialContent(ctx, {
      artifactId: artifact._id,
      content: 'Part 1 Part 2',
      tokensGenerated: 10,
      sectionName: 'Introduction',
      sectionIndex: 0,
      isComplete: false,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(artifact._id, expect.objectContaining({
      content: 'Part 1 Part 2',
      streamStatus: 'streaming',
    }));
  });

  it('creates version on section complete', async () => {
    const ctx = createMockCtx();
    const artifact = createMockArtifact({ content: '', currentVersionNumber: 1 });
    
    await appendPartialContent(ctx, {
      artifactId: artifact._id,
      content: 'Full section content',
      tokensGenerated: 100,
      sectionName: 'Section 1',
      sectionIndex: 0,
      isComplete: true,
    });

    expect(ctx.db.insert).toHaveBeenCalledWith('artifactVersions', expect.objectContaining({
      artifactId: artifact._id,
      version: 2,
      changeType: 'section_regen',
    }));
  });
});
```

### 6.2 Component Tests

```typescript
// components/__tests__/streaming/SectionProgress.test.tsx

import { render, screen } from '@testing-library/react';
import { SectionProgress } from '../SectionProgress';

describe('SectionProgress', () => {
  it('displays correct progress percentage', () => {
    render(<SectionProgress sectionsCompleted={2} sectionsTotal={4} />);
    
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('shows estimated time remaining', () => {
    render(
      <SectionProgress
        sectionsCompleted={1}
        sectionsTotal={3}
        estimatedTimeRemaining={120}
      />
    );
    
    expect(screen.getByText('~2 min remaining')).toBeInTheDocument();
  });

  it('shows current section name', () => {
    render(
      <SectionProgress
        sectionsCompleted={0}
        sectionsTotal={2}
        currentSection="User Stories"
      />
    );
    
    expect(screen.getByText('Section 1 of 2: User Stories')).toBeInTheDocument();
  });
});
```

### 6.3 E2E Tests

```typescript
// e2e/streaming.test.ts

import { test, expect } from '@playwright/test';

test('streaming shows content as it generates', async ({ page }) => {
  // Navigate to phase page
  await page.goto('/project/test-id/phase/prd');
  
  // Click generate
  await page.click('button:has-text("Generate PRD")');
  
  // Wait for streaming to start
  await expect(page.locator('text=Generating...')).toBeVisible();
  
  // Verify initial content appears within 500ms
  await page.waitForTimeout(500);
  const content = await page.locator('.prose').textContent();
  expect(content?.length).toBeGreaterThan(0);
  
  // Verify progress bar updates
  await expect(page.locator('[role="progressbar"]')).toBeVisible();
});
```

---

## 7. Performance Requirements

### 7.1 Metrics Targets

| Metric | Target | Measurement |
| ------ | ------ | ------------|
| First token latency | < 500ms | P95 from telemetry |
| Update frequency | ≥ 10 tokens/sec | Per streaming session |
| Memory usage | < 50MB increase | Per client session |
| Convex writes | ≤ 20 per section | Database optimization |

### 7.2 Optimization Strategies

```typescript
// Frontend memoization
export const StreamingArtifact = memo(function StreamingArtifact({
  projectId,
  phaseId,
  artifactId,
}: StreamingArtifactProps) {
  // Component implementation
});

// Throttled updates for progress bar
const throttledUpdate = useMemo(
  () => throttle((progress) => setProgress(progress), 100),
  []
);

// Virtualized content display for long artifacts
function MarkdownPreview({ content }: { content: string }) {
  const chunks = useMemo(() => chunkContent(content, 1000), [content]);
  const visibleChunks = useVirtualization(chunks);
  
  return (
    <div>
      {visibleChunks.map(chunk => (
        <div key={chunk.index}>{chunk.content}</div>
      ))}
    </div>
  );
}
```

---

## 8. Implementation Checklist

### Day 1: Database & Backend Foundation

- [ ] Deploy schema migration to dev
- [ ] Create `appendPartialContent` mutation
- [ ] Create `logTelemetryEvent` mutation
- [ ] Verify migration with convex dashboard

### Day 2: Worker Modifications

- [ ] Modify `generatePhaseWorker` for streaming
- [ ] Implement 50-token flush logic
- [ ] Add version creation on section complete
- [ ] Test with single LLM provider

### Day 3: Frontend Components

- [ ] Create `StreamingArtifact` component
- [ ] Create `SectionProgress` component
- [ ] Create `StreamingStatus` component
- [ ] Create `CancelButton` component

### Day 4: Page Integration

- [ ] Update phase page with streaming UI
- [ ] Add cancel mutation integration
- [ ] Test reactive updates with Convex
- [ ] Verify cancel functionality

### Day 5: Provider Integration

- [ ] Implement OpenAI streaming
- [ ] Implement Anthropic streaming
- [ ] Implement DeepSeek streaming
- [ ] Add fallback for Z.AI, Minimax

### Day 6: Testing

- [ ] Write unit tests for mutations
- [ ] Write component tests
- [ ] E2E test streaming flow
- [ ] Performance testing

### Day 7: Polish & Validation

- [ ] Optimize token flush frequency
- [ ] Test error handling
- [ ] Verify all 7 providers work
- [ ] Final code review

---

## 9. Rollback Plan

### 9.1 If Issues Arise

```bash
# Revert schema changes
npx convex dev --once --run 'rollbackStreamingMigration()'

# Disable streaming feature flag
# Set NEXT_PUBLIC_ENABLE_STREAMING=false in .env.local
```

### 9.2 Data Recovery

- All versions preserved in `artifactVersions` table
- Original content stored as v1 of each artifact
- Can revert to batch mode while preserving data

---

## 10. Dependencies & Risks

### 10.1 External Dependencies

| Dependency | Status | Fallback |
| ---------- | ------ | -------- |
| Convex streaming support | Ready | Polling fallback |
| LLM provider streaming | 4/7 ready | Simulated streaming |
| Frontend memo libraries | Ready | None needed |

### 10.2 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
| ---- | ----------- | ------ | ---------- |
| LLM streaming failures | Medium | High | Fallback to batch mode |
| Convex write limits | Low | High | Flush every 50 tokens |
| Frontend performance | Medium | Medium | Memoization + virtualization |

---

## Document History

| Version | Date         | Author       | Changes     |
| ------- | ------------ | ------------ | ----------- |
| 1.0     | Jan 16, 2026 | Engineering  | Initial plan |

---

> **Next Steps:**
>
> 1. Review vertical slice plan with team
> 2. Set up feature branch: `feature/streaming-generation`
> 3. Begin Day 1 implementation
> 4. Daily sync during implementation
