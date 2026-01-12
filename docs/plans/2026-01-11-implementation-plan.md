# SpecForge Implementation Plan: Codebase Completion

> Comprehensive plan to address all 23 issues identified in the codebase analysis.

**Created:** January 11, 2026  
**Target Completion:** 3 Sprints (6 work days)  
**Reference:** [Codebase Analysis](./2026-01-11-codebase-analysis.md)

---

## Overview

This plan addresses issues in priority order across 3 sprints:

| Sprint   | Focus                    | Issues Covered                                            |
| -------- | ------------------------ | --------------------------------------------------------- |
| Sprint 1 | Critical LLM Integration | #1, #2, #11, #14                                          |
| Sprint 2 | Security & Authorization | #3, #17, #18, #19, #13, #16                               |
| Sprint 3 | Completeness & Quality   | #4, #5, #6, #8, #9, #10, #12, #15, #20, #21, #22, #23          |

**⚠️ NOTE:** Issues #7 (generateProjectZip.ts incomplete), #12 (ZIP download flow incomplete) are not addressed in this plan. These require separate investigation and implementation planning.

---

## Sprint 1: Critical LLM Integration (Priority: HIGHEST)

### Task 1.1: Implement Real LLM Calls in generatePhase.ts

**Files to Modify:**

- `convex/actions/generatePhase.ts`

**Changes Required:**

1. **Update `generateSectionContent` function** (Lines ~387-451):

```typescript
async function generateSectionContent(params: {
  projectContext: { title: string; description: string; questions: string };
  sectionName: string;
  sectionInstructions: string;
  sectionQuestions: string[];
  previousSections: Array<{ name: string; content: string }>;
  model: any;
  maxTokens: number;
  llmClient: ReturnType<typeof getLlmClient>;
  providerInfo: string;
  phaseId: string;
}): Promise<string> {
  const { llmClient, model, maxTokens } = params;

  // Guard: No LLM client available
  if (!llmClient) {
    console.warn(
      '[generateSectionContent] No LLM client available, using fallback'
    );
    return `## ${formatSectionName(params.sectionName)}\n\n_Content generation requires LLM configuration. Please configure your API keys in Settings._`;
  }

  // Build the prompt
  const systemPrompt = `You are an expert technical writer creating project documentation.
Generate the "${params.sectionName}" section for a ${params.phaseId} document.

Project: ${params.projectContext.title}
Description: ${params.projectContext.description}

${params.sectionInstructions}

Requirements:
- Use markdown formatting
- Be thorough and detailed
- Include specific, actionable content
- Reference the project context throughout`;

  const userPrompt = `${
    params.previousSections.length > 0
      ? `Previous sections for context:\n${params.previousSections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n')}\n\n`
      : ''
  }
${
  params.sectionQuestions.length > 0
    ? `Address these points:\n${params.sectionQuestions.map((q) => `- ${q}`).join('\n')}\n\n`
    : ''
}
Generate the "${params.sectionName}" section now:`;

  try {
    const response = await llmClient.complete(
      `${systemPrompt}\n\n${userPrompt}`,
      {
        model: model.id,
        maxTokens: maxTokens,
        temperature: 0.7,
      }
    );

    return response.content;
  } catch (error: any) {
    console.error(`[generateSectionContent] LLM call failed:`, error?.message);
    throw new Error(
      `Failed to generate ${params.sectionName}: ${error?.message}`
    );
  }
}
```

2. **Update `selfCritiqueSection` function** (Lines ~464-488):

```typescript
async function selfCritiqueSection(params: {
  content: string;
  sectionName: string;
  projectContext: { title: string; description: string };
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  const { llmClient, model, content, sectionName, projectContext } = params;

  if (!llmClient) {
    return content; // Return original if no LLM available
  }

  const critiquePrompt = `Review this "${sectionName}" section for a project called "${projectContext.title}".

Content to review:
${content}

Analyze for:
1. Completeness - are all key points covered?
2. Clarity - is the content clear and actionable?
3. Consistency - does it align with the project description?
4. Quality - is it detailed enough for a handoff document?

If improvements are needed, provide the improved version.
If the content is sufficient, respond with "APPROVED" followed by the original content.`;

  try {
    const response = await llmClient.complete(critiquePrompt, {
      model: model.id,
      maxTokens: Math.min(model.maxOutputTokens, 4000),
      temperature: 0.3,
    });

    // Check if approved or extract improved content
    if (response.content.startsWith('APPROVED')) {
      return content;
    }
    return response.content;
  } catch (error) {
    console.warn(
      '[selfCritiqueSection] Critique failed, using original content'
    );
    return content;
  }
}
```

**Verification:**

- [ ] Run `npm run build` - no TypeScript errors
- [ ] Test phase generation with configured API keys
- [ ] Verify artifacts contain real LLM-generated content

---

### Task 1.2: Implement Real LLM Calls in Question Answer Actions

**Files to Modify:**

- `convex/actions/generateQuestionAnswer.ts`
- `convex/actions/generateAllQuestionAnswers.ts`

**Changes Required:**

1. **Update `generateAnswer` in both files:**

```typescript
async function generateAnswer(params: {
  prompt: string;
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  const { llmClient, model, prompt } = params;

  if (!llmClient) {
    throw new Error(
      'No LLM client available. Please configure your API keys in Settings.'
    );
  }

  try {
    const response = await llmClient.complete(prompt, {
      model: model.id,
      maxTokens: Math.min(model.maxOutputTokens || 2000, 2000),
      temperature: 0.7,
    });

    return response.content.trim();
  } catch (error: any) {
    console.error('[generateAnswer] LLM call failed:', error?.message);
    throw new Error(`Failed to generate answer: ${error?.message}`);
  }
}
```

**Verification:**

- [ ] Test individual question AI suggest button
- [ ] Test batch "Let AI answer all" functionality
- [ ] Verify answers are contextually relevant

---

### Task 1.3: Extract Shared getLlmClient Utility

**Files to Create:**

- `lib/llm/client-factory.ts`

**Files to Modify:**

- `convex/actions/generatePhase.ts`
- `convex/actions/generateQuestionAnswer.ts`
- `convex/actions/generateAllQuestionAnswers.ts`

**New File Content:**

```typescript
// lib/llm/client-factory.ts
import { createOpenAIClient } from './providers/openai';
import { createAnthropicClient } from './providers/anthropic';
import { createZAIClient } from './providers/zai';
import { createMinimaxClient } from './providers/minimax';
import type { ProviderCredentials, LlmProvider } from './types';

export function createLlmClient(
  credentials: ProviderCredentials | null
): LlmProvider | null {
  if (!credentials || !credentials.apiKey) {
    return null;
  }

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
      console.warn(
        `[createLlmClient] Unsupported provider: ${credentials.provider}`
      );
      return null;
  }
}
```

**Update Action Files:**

```typescript
// Replace local getLlmClient with import
import { createLlmClient } from '../../lib/llm/client-factory';

// Usage
const llmClient = createLlmClient(credentials);
```

---

## Sprint 2: Security & Authorization

### Task 2.1: Enable Admin Role Authorization

**Files to Modify:**

- `convex/lib/auth.ts` (create new)
- `convex/admin.ts`
- `convex/systemCredentials.ts`
- `convex/systemCredentialActions.ts`

**Changes Required:**

1. **Create admin check helper:**

```typescript
// convex/lib/auth.ts (new file)
import type { QueryCtx, MutationCtx, ActionCtx } from './_generated/server';

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthenticated');
  }

  const publicMetadata = identity.publicMetadata as
    | { role?: string }
    | undefined;
  if (publicMetadata?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required');
  }
}

export async function isAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const publicMetadata = identity.publicMetadata as
    | { role?: string }
    | undefined;
  return publicMetadata?.role === 'admin';
}
```

2. **Update ALL admin functions to use the helper:**

**convex/admin.ts - 6 functions need updates:**

```typescript
import { requireAdmin } from './lib/auth';

export const listAllModels = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx); // ADD THIS LINE
    return await ctx.db.query("llmModels").collect();
  },
});

export const addModel = mutation({
  args: { /* ... */ },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    return await ctx.db.insert("llmModels", args);
  },
});

export const updateModel = mutation({
  args: { /* ... */ },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});

export const deleteModel = mutation({
  args: { modelId: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});

export const listSystemCredentials = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx); // ADD THIS LINE
    return await ctx.db.query("systemCredentials").collect();
  },
});

export const getSystemCredential = query({
  args: { provider: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});

export const deleteSystemCredential = mutation({
  args: { provider: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});

export const getSystemStats = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});
```

**convex/systemCredentials.ts - 1 function needs update:**

```typescript
import { requireAdmin } from './lib/auth';

export const getSystemCredentialRaw = query({
  args: { provider: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});
```

**convex/systemCredentialActions.ts - 2 functions need updates:**

```typescript
import { requireAdmin } from './lib/auth';

export const setSystemCredential = action({
  args: { /* ... */ },
  handler: async (ctx: ActionCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});

export const deleteSystemCredential = action({
  args: { provider: v.string() },
  handler: async (ctx: ActionCtx, args) => {
    await requireAdmin(ctx); // ADD THIS LINE
    // ... rest of handler
  },
});
```

---

### Task 2.2: Remove Security-Sensitive Logging

**Files to Modify:**

- `convex/internalActions.ts`

**Changes Required:**

**⚠️ CRITICAL:** All API key logging must be completely removed, not made conditional. Previewing encrypted keys in console is a security vulnerability.

1. **Remove ALL sensitive console.log statements:**

```typescript
// DELETE these lines (~136-140 in internalActions.ts):
console.log(
  '[...] Decrypted key preview (first 10 chars):',
  decryptedApiKey ? decryptedApiKey.substring(0, 10) + '...' : 'null'
);

// DELETE these lines (encrypted key preview logs):
console.log('[setSystemCredential] Encrypted API key successfully, byte length:', encryptedBytes.length);
console.log('[setSystemCredential] JSON preview:', jsonString.substring(0, 50) + '...');

// DELETE or replace with debugLog():
// Keep only benign logs (like "Saving credential for provider:")
// For development debugging, replace with conditional debug logging:
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Example usage - SAFE to log:
debugLog('[setSystemCredential] Saving credential for provider:', args.provider);
// Example usage - UNSAFE to log (delete):
// debugLog('[setSystemCredential] Encrypted key:', jsonString); // DON'T DO THIS
```

---

### Task 2.3: Improve Encryption Key Handling

**Files to Modify:**

- `convex/internalActions.ts`
- `convex/userConfigs.ts`

**Changes Required:**

```typescript
// Replace fallback pattern
const ENCRYPTION_KEY = process.env.CONVEX_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error(
    'CONVEX_ENCRYPTION_KEY environment variable is required. ' +
      'Set it in your Convex dashboard under Settings > Environment Variables.'
  );
}
```

---

### Task 2.4: Add Rate Limiting Using Convex Rate Limiter

**⚠️ IMPORTANT:** In-memory rate limiting does not work in Convex because each function runs in a separate instance. Use the official `@convex-dev/rate-limiter` package instead.

**Prerequisites:**

```bash
bun add @convex-dev/rate-limiter
```

**Files to Create:**

- `convex/rateLimiter.ts`
- `convex/lib/ratelimit.ts`

**Implementation:**

```typescript
// convex/rateLimiter.ts
import { RateLimiter, MINUTE, SECOND } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Limit phase generation: 10 per minute per user
  generatePhase: {
    kind: "token bucket",
    period: MINUTE,
    rate: 10,
    capacity: 15, // Allow bursts up to 15
  },
  // Limit question answering: 30 per minute per user
  generateQuestionAnswer: {
    kind: "token bucket",
    period: MINUTE,
    rate: 30,
    capacity: 50, // Allow bursts up to 50
  },
  // Global limits to prevent abuse
  globalPhaseGen: {
    kind: "fixed window",
    period: MINUTE,
    rate: 100, // 100 total per minute across all users
  },
});
```

**Update convex/actions/generatePhase.ts:**

```typescript
import { rateLimiter } from "../rateLimiter";

// At the start of generatePhase action:
export const generatePhase = action({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const userId = identity.tokenIdentifier;

    // Check per-user rate limit
    const userLimit = await rateLimiter.limit(ctx, "generatePhase", {
      key: userId,
      throws: true,
    });

    // Check global rate limit
    await rateLimiter.limit(ctx, "globalPhaseGen", { throws: true });

    // Rest of handler...
  },
});
```

**Update convex/actions/generateQuestionAnswer.ts:**

```typescript
import { rateLimiter } from "../rateLimiter";

// At the start of generateAnswer function:
async function generateAnswer(params: {
  prompt: string;
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
  userId: string; // Add userId parameter
}): Promise<string> {
  // Check rate limit
  await rateLimiter.limit(ctx, "generateQuestionAnswer", {
    key: params.userId,
    throws: true,
  });

  // Rest of function...
}
```

---

## Sprint 3: Completeness & Quality

### Task 3.1: Add Missing PRD Phase

**Files to Modify:**

- `convex/projects.ts`
- `convex/actions/generatePhase.ts`

**Changes:**

```typescript
// convex/projects.ts
const DEFAULT_PHASES = [
  'brief',
  'prd',
  'specs',
  'stories',
  'artifacts',
  'handoff',
];
```

```typescript
// convex/actions/generatePhase.ts - Add PRD section plan
const PHASE_SECTION_PLANS: Record<string, SectionPlan[]> = {
  // ... existing
  prd: [
    { name: 'executive-summary', maxTokens: 2000 },
    { name: 'problem-statement', maxTokens: 2000 },
    { name: 'goals-and-objectives', maxTokens: 2000 },
    { name: 'user-personas', maxTokens: 3000 },
    { name: 'requirements', maxTokens: 4000 },
    { name: 'success-metrics', maxTokens: 1500 },
  ],
};
```

---

### Task 3.2: Create Mistral Provider

**Files to Create:**

- `lib/llm/providers/mistral.ts`

```typescript
import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import { fetchWithTimeout } from '../response-normalizer';

export class MistralClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.mistral.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(
    prompt: string,
    options: { model: string; maxTokens?: number; temperature?: number }
  ): Promise<LlmResponse> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens ?? 4000,
          temperature: options.temperature ?? 0.7,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  async generateSection(
    request: LlmSectionRequest
  ): Promise<{ content: string; tokens: number }> {
    const response = await this.complete(
      `${this.buildSystemPrompt(request)}\n\n${this.buildUserPrompt(request)}`,
      { model: request.modelId, maxTokens: request.maxTokens }
    );
    return {
      content: response.content,
      tokens: response.usage.completionTokens,
    };
  }

  private buildSystemPrompt(request: LlmSectionRequest): string {
    return `You are an expert technical writer creating project documentation.
Generate the "${request.sectionName}" section for a ${request.phaseId} document.

Project: ${request.projectContext.title}
Description: ${request.projectContext.description}

${request.sectionInstructions}

Requirements:
- Use markdown formatting
- Be thorough and detailed
- Include specific, actionable content
- Reference the project context throughout`;
  }

  private buildUserPrompt(request: LlmSectionRequest): string {
    const previousSectionsText =
      request.previousSections && request.previousSections.length > 0
        ? `Previous sections for context:\n${request.previousSections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n')}\n\n`
        : '';

    const questionsText =
      request.questions && request.questions.length > 0
        ? `Address these points:\n${request.questions.map((q) => `- ${q}`).join('\n')}\n\n`
        : '';

    return `${previousSectionsText}${questionsText}Generate the "${request.sectionName}" section now:`;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export function createMistralClient(apiKey: string): MistralClient {
  return new MistralClient(apiKey);
}
```

**Update client-factory.ts:**

```typescript
import { createMistralClient } from './providers/mistral';

// Add to switch statement in createLlmClient function:
case 'mistral':
  return createMistralClient(credentials.apiKey);
```

---

### Task 3.3: Fix Schema Mismatches

**Files to Modify:**

- `convex/schema.ts`

**Add missing field:**

```typescript
userLlmConfigs: defineTable({
  userId: v.string(),
  provider: v.string(),
  apiKey: v.optional(v.bytes()),
  defaultModel: v.string(),
  useSystem: v.boolean(),
  systemKeyId: v.optional(v.string()), // ADD THIS
  zaiEndpointType: v.optional(v.union(v.literal("paid"), v.literal("coding"))),
  zaiIsChina: v.optional(v.boolean()),
}).index("by_user", ["userId"]),
```

---

### Task 3.4: Improve Type Safety

**Files to Modify:**

- `convex/actions/generatePhase.ts`
- `convex/actions/generateQuestionAnswer.ts`
- `convex/actions/generateAllQuestionAnswers.ts`

**Replace `any` types:**

```typescript
// Replace: let model: any;
// With:
import type { LlmModel } from '../../lib/llm/types';
let model: LlmModel;

// Replace: let systemCredentialsMap: any;
// With:
import type { SystemCredential } from '../../lib/llm/registry';
let systemCredentialsMap: Record<string, SystemCredential>;
```

---

### Task 3.5: Setup Basic Test Framework

**Files to Create:**

- `vitest.config.ts`
- `lib/__tests__/encryption.test.ts`
- `lib/llm/__tests__/registry.test.ts`

**Install Dependencies:**

```bash
bun add -d vitest @vitest/coverage-v8
```

**vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
  },
});
```

**Add to package.json:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

**Sample test:**

```typescript
// lib/__tests__/encryption.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../encryption';

describe('encryption', () => {
  const password = 'test-encryption-key-32-characters!';

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = encrypt(plaintext, password);
    const decrypted = decrypt(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext each time', () => {
    const plaintext = 'same-input';
    const encrypted1 = encrypt(plaintext, password);
    const encrypted2 = encrypt(plaintext, password);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });
});
```

---

## Verification Checklist

After completing all sprints:

### Build & Lint

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes with no warnings
- [ ] `npm run typecheck` passes

### Functional Tests

- [ ] Create new project → questions generated
- [ ] Generate phase → real LLM content produced
- [ ] AI answer individual question → contextual response
- [ ] AI answer all questions → batch works correctly
- [ ] ZIP download → proper folder structure

### Security Tests

- [ ] Non-admin user cannot access admin routes
- [ ] No API keys logged in console
- [ ] Rate limiting triggers after threshold

### Integration Tests

- [ ] OpenAI provider works
- [ ] Anthropic provider works
- [ ] Z.AI provider works
- [ ] Minimax provider works
- [ ] Mistral provider works (new)

---

## Rollback Plan

If issues occur:

1. **Git revert** - Each sprint should be a separate branch
2. **Environment flags** - Use feature flags for new functionality
3. **Gradual rollout** - Test with single provider first

---

## Dependencies & Prerequisites

### Environment Variables Required

```
CONVEX_ENCRYPTION_KEY=<32+ character secure key>
CLERK_SECRET_KEY=<from Clerk dashboard>
CLERK_PUBLISHABLE_KEY=<from Clerk dashboard>
```

### Clerk Configuration

- Admin role must be configured in Clerk dashboard
- Users must have `publicMetadata.role = "admin"` for admin access

---

## Timeline Summary

| Day | Sprint   | Tasks                              |
| --- | -------- | ---------------------------------- |
| 1   | Sprint 1 | Tasks 1.1, 1.2                     |
| 2   | Sprint 1 | Tasks 1.3, verification            |
| 3   | Sprint 2 | Tasks 2.1 (9 functions), 2.2         |
| 4   | Sprint 2 | Tasks 2.3, 2.4                     |
| 5   | Sprint 3 | Tasks 3.1, 3.2, 3.3                |
| 6   | Sprint 3 | Tasks 3.4, 3.5, final verification |

---

> **Ready to start?** Begin with Sprint 1, Task 1.1 - the most critical fix.

---

## Plan Updates & Corrections (January 11, 2026)

**Version 2** of this implementation plan includes corrections based on fact-checking with:

### Corrections Made

1. **Task 2.4 - Rate Limiting (CRITICAL FIX)**
   - **Problem:** Original plan proposed in-memory `Map`-based rate limiting
   - **Why it's wrong:** Convex functions run in isolated instances - in-memory state doesn't persist between invocations
   - **Correction:** Switched to official `@convex-dev/rate-limiter` package (Convex-specific, uses database-backed storage)
   - **Source:** https://www.convex.dev/components/rate-limiter and https://github.com/get-convex/rate-limiter

2. **Task 2.1 - Admin Authorization (COMPREHENSIVE UPDATE)**
   - **Problem:** Original plan only showed one example function needing admin checks
   - **Why incomplete:** After codebase review, found **9 functions** across 3 files need admin role checks:
     - `convex/admin.ts`: `listAllModels`, `addModel`, `updateModel`, `deleteModel`, `listSystemCredentials`, `getSystemCredential`, `deleteSystemCredential`, `getSystemStats`
     - `convex/systemCredentials.ts`: `getSystemCredentialRaw`
     - `convex/systemCredentialActions.ts`: `setSystemCredential`, `deleteSystemCredential`
   - **Correction:** Added complete list of all functions requiring `await requireAdmin(ctx)` calls

3. **Task 2.2 - Security Logging (STRENGTHENED)**
   - **Problem:** Original plan suggested conditional debug logging with `DEBUG` flag
   - **Why dangerous:** Even conditional logging of API keys (even previewing first 10 characters) is a security vulnerability
   - **Correction:** Explicitly instruct to **DELETE** all API key logging statements, not make them conditional

4. **Task 3.2 - Mistral Provider (CODE COMPLETION)**
   - **Problem:** Original code had `// Similar to OpenAI implementation` placeholder comments
   - **Why incomplete:** Build would fail with those comments
   - **Correction:** Implemented full `buildSystemPrompt()` and `buildUserPrompt()` methods with actual code

5. **Overview Table (CLARIFICATION)**
   - **Addition:** Added note that issues #7 and #12 from codebase analysis are NOT addressed in this plan
   - **Reason:** These require separate investigation (`generateProjectZip.ts` incomplete, ZIP download flow incomplete)

### Verification Sources

- Convex Documentation: https://context7.llmstxt/convex_dev_llms-full_txt
- Convex Rate Limiter: https://www.convex.dev/components/rate-limiter
- Convex Rate Limiter GitHub: https://github.com/get-convex/rate-limiter
- Codebase analysis of `convex/admin.ts`, `convex/systemCredentials.ts`, `convex/systemCredentialActions.ts`
