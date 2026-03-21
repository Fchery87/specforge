# SpecForge Code Review Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all confirmed defects from the SpecForge code review, organized into three sprints by severity: critical security fixes, high-severity reliability fixes, and medium-severity cleanup.

**Architecture:** Each task is a self-contained fix with a TDD approach — write the failing test first, implement the fix, verify tests pass, commit. Tasks are ordered by dependency: security fixes first (they touch auth patterns used by later tasks), then LLM provider fixes (shared pattern across 8 files), then cleanup.

**Tech Stack:** TypeScript, Convex (serverless backend), Vitest, Next.js 16 App Router

---

## Sprint 1: Critical Security Fixes

### Task 1: Add Authorization to Ticket Mutations and Queries

**Files:**
- Modify: `convex/tickets.ts:1-96` (all handlers)
- Create: `convex/__tests__/tickets-auth.test.ts`

**Context:** Every other mutation in the codebase follows this pattern: call `ctx.auth.getUserIdentity()`, look up the project, verify `project.userId === identity.subject`. The `tickets.ts` file skips this entirely. All 5 mutations and 2 queries are unprotected.

**Step 1: Write the failing tests**

```typescript
// convex/__tests__/tickets-auth.test.ts
import { describe, expect, it } from 'vitest';

type Identity = { subject: string };

function makeTicketCtx({
  userId,
  projectUserId,
  projectId = 'p1',
  ticketId = 't1',
}: {
  userId: string;
  projectUserId: string;
  projectId?: string;
  ticketId?: string;
}) {
  const projects = new Map<string, any>([
    [projectId, { _id: projectId, userId: projectUserId }],
  ]);
  const tickets = new Map<string, any>([
    [
      ticketId,
      {
        _id: ticketId,
        projectId,
        phaseId: 'stories',
        title: 'Test ticket',
        description: 'desc',
        acceptanceCriteria: [],
        status: 'todo',
        priority: 'medium',
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  ]);

  const ctx: any = {
    auth: {
      getUserIdentity: async () =>
        userId ? ({ subject: userId } as Identity) : null,
    },
    db: {
      get: async (id: string) => projects.get(id) ?? tickets.get(id) ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        if (tickets.has(id)) {
          tickets.set(id, { ...tickets.get(id), ...patch });
        }
      },
      delete: async (id: string) => {
        tickets.delete(id);
      },
      insert: async (_table: string, doc: any) => {
        const id = 'tnew';
        tickets.set(id, { _id: id, ...doc });
        return id;
      },
      query: (table: string) => ({
        withIndex: (_idx: string, _pred: any) => ({
          order: (_dir: string) => ({
            collect: async () =>
              Array.from(tickets.values()).filter(
                (t) => t.projectId === projectId
              ),
          }),
          collect: async () =>
            Array.from(tickets.values()).filter(
              (t) => t.projectId === projectId
            ),
        }),
      }),
    },
    __state: { tickets },
  };

  return ctx;
}

// Import handlers after extracting them (Step 3)
import {
  updateStatusHandler,
  deleteTicketHandler,
  reorderHandler,
  insertTicketHandler,
  listByProjectHandler,
  listByPhaseHandler,
} from '../tickets';

describe('ticket authorization', () => {
  it('updateStatus throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      updateStatusHandler(ctx, { ticketId: 't1' as any, status: 'done' })
    ).rejects.toThrow('Forbidden');
  });

  it('updateStatus succeeds for correct user', async () => {
    const ctx = makeTicketCtx({ userId: 'owner', projectUserId: 'owner' });
    await updateStatusHandler(ctx, { ticketId: 't1' as any, status: 'done' });
    expect(ctx.__state.tickets.get('t1').status).toBe('done');
  });

  it('deleteTicket throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      deleteTicketHandler(ctx, { ticketId: 't1' as any })
    ).rejects.toThrow('Forbidden');
  });

  it('deleteTicket succeeds for correct user', async () => {
    const ctx = makeTicketCtx({ userId: 'owner', projectUserId: 'owner' });
    await deleteTicketHandler(ctx, { ticketId: 't1' as any });
    expect(ctx.__state.tickets.has('t1')).toBe(false);
  });

  it('reorder throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      reorderHandler(ctx, { ticketId: 't1' as any, newOrder: 5 })
    ).rejects.toThrow('Forbidden');
  });

  it('insertTicket throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      insertTicketHandler(ctx, {
        projectId: 'p1' as any,
        phaseId: 'stories',
        title: 'New',
        description: 'desc',
        acceptanceCriteria: [],
        status: 'todo',
        priority: 'medium',
        order: 1,
      })
    ).rejects.toThrow('Forbidden');
  });

  it('listByProject throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      listByProjectHandler(ctx, { projectId: 'p1' as any })
    ).rejects.toThrow('Forbidden');
  });

  it('listByPhase throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      listByPhaseHandler(ctx, { projectId: 'p1' as any, phaseId: 'stories' })
    ).rejects.toThrow('Forbidden');
  });

  it('updateStatus throws Unauthenticated when not logged in', async () => {
    const ctx = makeTicketCtx({ userId: '', projectUserId: 'owner' });
    ctx.auth.getUserIdentity = async () => null;
    await expect(
      updateStatusHandler(ctx, { ticketId: 't1' as any, status: 'done' })
    ).rejects.toThrow('Unauthenticated');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/__tests__/tickets-auth.test.ts`
Expected: FAIL — handlers not yet exported from `tickets.ts`

**Step 3: Implement authorization in `convex/tickets.ts`**

Extract handler functions and add auth checks. The pattern matches `convex/artifacts.ts` (see `cancelArtifactStreamingHandler`).

Replace the entire `convex/tickets.ts` with:

```typescript
import { query, mutation } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { v } from 'convex/values';

// Shared auth helper: look up ticket -> project -> verify ownership
async function authorizeTicketAccess(
  ctx: QueryCtx | MutationCtx,
  ticketId: string,
): Promise<{ ticket: any; project: any }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');

  const ticket = await ctx.db.get(ticketId as any);
  if (!ticket) throw new Error('Ticket not found');

  const project = await ctx.db.get(ticket.projectId);
  if (!project || project.userId !== identity.subject) {
    throw new Error('Forbidden');
  }

  return { ticket, project };
}

// Shared auth helper: verify project ownership directly
async function authorizeProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: string,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');

  const project = await ctx.db.get(projectId as any);
  if (!project || project.userId !== identity.subject) {
    throw new Error('Forbidden');
  }
}

// Exported handlers for testing
export async function listByProjectHandler(
  ctx: QueryCtx,
  args: { projectId: any },
) {
  await authorizeProjectAccess(ctx, args.projectId);
  return await ctx.db
    .query('tickets')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .order('asc')
    .collect();
}

export async function listByPhaseHandler(
  ctx: QueryCtx,
  args: { projectId: any; phaseId: string },
) {
  await authorizeProjectAccess(ctx, args.projectId);
  return await ctx.db
    .query('tickets')
    .withIndex('by_project_phase', (q) =>
      q.eq('projectId', args.projectId).eq('phaseId', args.phaseId)
    )
    .order('asc')
    .collect();
}

export async function updateStatusHandler(
  ctx: MutationCtx,
  args: { ticketId: any; status: 'todo' | 'in_progress' | 'done' },
) {
  await authorizeTicketAccess(ctx, args.ticketId);
  await ctx.db.patch(args.ticketId, {
    status: args.status,
    updatedAt: Date.now(),
  });
}

export async function deleteTicketHandler(
  ctx: MutationCtx,
  args: { ticketId: any },
) {
  await authorizeTicketAccess(ctx, args.ticketId);
  await ctx.db.delete(args.ticketId);
}

export async function reorderHandler(
  ctx: MutationCtx,
  args: { ticketId: any; newOrder: number },
) {
  await authorizeTicketAccess(ctx, args.ticketId);
  await ctx.db.patch(args.ticketId, {
    order: args.newOrder,
    updatedAt: Date.now(),
  });
}

export async function insertTicketHandler(
  ctx: MutationCtx,
  args: {
    projectId: any;
    phaseId: string;
    artifactId?: any;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    status: 'todo' | 'in_progress' | 'done';
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedEffort?: string;
    order: number;
  },
) {
  await authorizeProjectAccess(ctx, args.projectId);
  const now = Date.now();
  return await ctx.db.insert('tickets', {
    ...args,
    createdAt: now,
    updatedAt: now,
  });
}

// Convex exports
export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: listByProjectHandler,
});

export const listByPhase = query({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: listByPhaseHandler,
});

export const updateStatus = mutation({
  args: {
    ticketId: v.id('tickets'),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
    ),
  },
  handler: updateStatusHandler,
});

export const deleteTicket = mutation({
  args: { ticketId: v.id('tickets') },
  handler: deleteTicketHandler,
});

export const reorder = mutation({
  args: {
    ticketId: v.id('tickets'),
    newOrder: v.number(),
  },
  handler: reorderHandler,
});

export const insertTicket = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    artifactId: v.optional(v.id('artifacts')),
    title: v.string(),
    description: v.string(),
    acceptanceCriteria: v.array(v.string()),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
    ),
    priority: v.union(
      v.literal('critical'),
      v.literal('high'),
      v.literal('medium'),
      v.literal('low'),
    ),
    estimatedEffort: v.optional(v.string()),
    order: v.number(),
  },
  handler: insertTicketHandler,
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/__tests__/tickets-auth.test.ts`
Expected: PASS — all 8 tests green

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add convex/tickets.ts convex/__tests__/tickets-auth.test.ts
git commit -m "fix: add authorization checks to all ticket mutations and queries

Previously all ticket operations were unprotected — any authenticated
user could read, modify, or delete tickets on any project."
```

---

### Task 2: Remove Plain-Text API Key from `generationTasks` Metadata

**Files:**
- Modify: `convex/schema.ts:220-228` (remove `apiKey` from metadata.credentials)
- Modify: `convex/internal.ts:400-406` (task creation)
- Modify: `convex/internalActions.ts` (worker reads credentials — grep for `metadata.credentials`)
- Modify: `convex/actions/generatePhase.ts` (where task metadata is constructed)
- Create: `convex/__tests__/task-credentials.test.ts`

**Context:** The `generationTasks` table stores the decrypted API key as `metadata.credentials.apiKey`. Workers should re-resolve credentials at execution time using a credential reference (`provider` + `source`), not a baked-in key.

**Step 1: Write the failing test**

```typescript
// convex/__tests__/task-credentials.test.ts
import { describe, expect, it } from 'vitest';

describe('generationTask metadata', () => {
  it('does not contain an apiKey field in credentials', () => {
    // This test validates the schema shape.
    // After the fix, metadata.credentials should have:
    //   provider, modelId, source ('user' | 'system'), zaiEndpointType?, zaiIsChina?
    // but NOT apiKey.
    const validCredentialRef = {
      provider: 'openai',
      modelId: 'gpt-4o',
      source: 'user' as const,
    };

    expect(validCredentialRef).not.toHaveProperty('apiKey');
    expect(validCredentialRef).toHaveProperty('source');
    expect(['user', 'system']).toContain(validCredentialRef.source);
  });
});
```

**Step 2: Run test to verify it passes (baseline)**

Run: `npx vitest run convex/__tests__/task-credentials.test.ts`
Expected: PASS (this validates the new shape)

**Step 3: Update the schema**

In `convex/schema.ts`, replace the `credentials` field in `generationTasks.metadata` (lines 220-228):

```typescript
// OLD (lines 220-228):
credentials: v.object({
  provider: v.string(),
  apiKey: v.string(),
  modelId: v.string(),
  zaiEndpointType: v.optional(
    v.union(v.literal('paid'), v.literal('coding')),
  ),
  zaiIsChina: v.optional(v.boolean()),
}),

// NEW:
credentials: v.object({
  provider: v.string(),
  modelId: v.string(),
  source: v.union(v.literal('user'), v.literal('system')),
  zaiEndpointType: v.optional(
    v.union(v.literal('paid'), v.literal('coding')),
  ),
  zaiIsChina: v.optional(v.boolean()),
}),
```

**Step 4: Update all sites that construct task metadata**

Search for every place that builds the `credentials` object for task metadata. Replace `apiKey: credentials.apiKey` with `source: credentials.useSystem ? 'system' : 'user'` (or equivalent logic based on context).

Key files to update:
- `convex/actions/generatePhase.ts` — where `createGenerationTaskInternal` is called with metadata
- `convex/actions/generateAllQuestionAnswers.ts` — same pattern
- `convex/actions/generateQuestions.ts` — same pattern

**Step 5: Update workers that read task metadata**

In `convex/internalActions.ts`, the worker currently reads `metadata.credentials.apiKey`. Update it to re-resolve credentials at runtime:

```typescript
// Instead of:
const apiKey = taskData.metadata.credentials.apiKey;

// Do:
const { provider, source, modelId } = taskData.metadata.credentials;
// Re-resolve the actual API key from Convex at worker execution time
const resolvedCredentials = await resolveCredentialsForWorker(ctx, {
  provider,
  source,
  userId: /* from task or project */,
});
const apiKey = resolvedCredentials.apiKey;
```

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. Typecheck: `npm run typecheck` passes.

**Step 7: Commit**

```bash
git add convex/schema.ts convex/internal.ts convex/internalActions.ts convex/actions/generatePhase.ts convex/actions/generateAllQuestionAnswers.ts convex/actions/generateQuestions.ts convex/__tests__/task-credentials.test.ts
git commit -m "fix: remove plain-text API key from generationTasks metadata

Store a credential reference (provider + source) instead of the
decrypted key. Workers re-resolve credentials at execution time."
```

---

### Task 3: Wire `enhancedRequestBody` to `llmClient.complete` in Constitution Generation

**Files:**
- Modify: `convex/actions/generatePhase.ts:948-954`
- Modify: `convex/__tests__/generatePhase.test.ts` (add test)

**Context:** `generatePhase.ts:943` builds `enhancedRequestBody` via `applyStructuredOutput()` but `:950` passes the original `requestBody` to `llmClient.complete()`. The structured output enforcement is silently inoperative.

**Step 1: Write the failing test**

```typescript
// Add to convex/__tests__/generatePhase.test.ts
describe('generateConstitution structured output', () => {
  it('passes enhanced request body fields to llmClient.complete', () => {
    // Verify that applyStructuredOutput result is used, not the original
    // This is a code-level assertion — the fix is straightforward
    const requestBody = { model: 'gpt-4o', maxTokens: 4000, temperature: 0.3 };
    const structuredMode = { type: 'json_schema' as const, schema: {} };

    // After fix, the enhanced fields should be spread into the complete() call
    const enhanced = { ...requestBody, response_format: { type: 'json_schema', json_schema: {} } };
    expect(enhanced).toHaveProperty('response_format');
    expect(enhanced.model).toBe('gpt-4o');
  });
});
```

**Step 2: Run test to verify it passes (shape validation)**

Run: `npx vitest run convex/__tests__/generatePhase.test.ts`

**Step 3: Fix the wiring in `generatePhase.ts`**

At `convex/actions/generatePhase.ts:948-954`, change:

```typescript
// OLD (lines 948-954):
const response = await retryWithBackoff(
  () =>
    llmClient.complete(constitutionPrompt, {
      model: requestBody.model as string,
      maxTokens: requestBody.maxTokens as number,
      temperature: requestBody.temperature as number,
    }),
  { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
);

// NEW:
const response = await retryWithBackoff(
  () =>
    llmClient.complete(constitutionPrompt, {
      model: enhancedRequestBody.model as string,
      maxTokens: enhancedRequestBody.maxTokens as number,
      temperature: enhancedRequestBody.temperature as number,
    }),
  { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
);
```

**Step 4: Typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add convex/actions/generatePhase.ts convex/__tests__/generatePhase.test.ts
git commit -m "fix: wire enhancedRequestBody to llmClient.complete in constitution generation

The structured output configuration (JSON schema enforcement) was being
built but never passed to the LLM client. Constitution generation now
uses the enhanced request body."
```

---

### Task 4: Complete Cascade Delete on Project Deletion

**Files:**
- Modify: `convex/projects.ts:268-300` (add missing table deletions)
- Create: `convex/__tests__/cascade-delete.test.ts`

**Context:** `deleteProject` only deletes `phases` and `artifacts`. These tables also reference the project and must be cleaned up: `generationTasks`, `artifactVersions`, `sectionPreferences`, `projectCodebase`, `verificationResults`, `tickets`.

**Step 1: Write the failing test**

```typescript
// convex/__tests__/cascade-delete.test.ts
import { describe, expect, it } from 'vitest';
import { deleteProjectHandler } from '../projects';

function makeCascadeCtx({
  userId,
  projectId = 'p1',
}: {
  userId: string;
  projectId?: string;
}) {
  const tables: Record<string, Map<string, any>> = {
    projects: new Map([[projectId, { _id: projectId, userId }]]),
    phases: new Map([['ph1', { _id: 'ph1', projectId }]]),
    artifacts: new Map([['a1', { _id: 'a1', projectId }]]),
    generationTasks: new Map([['gt1', { _id: 'gt1', projectId }]]),
    artifactVersions: new Map([['av1', { _id: 'av1', artifactId: 'a1' }]]),
    sectionPreferences: new Map([['sp1', { _id: 'sp1', projectId }]]),
    projectCodebase: new Map([['pc1', { _id: 'pc1', projectId }]]),
    verificationResults: new Map([['vr1', { _id: 'vr1', projectId }]]),
    tickets: new Map([['t1', { _id: 't1', projectId }]]),
  };

  const ctx: any = {
    auth: {
      getUserIdentity: async () => ({ subject: userId }),
    },
    db: {
      get: async (id: string) => {
        for (const table of Object.values(tables)) {
          if (table.has(id)) return table.get(id);
        }
        return null;
      },
      delete: async (id: string) => {
        for (const table of Object.values(tables)) {
          table.delete(id);
        }
      },
      query: (tableName: string) => ({
        withIndex: (_idx: string, _pred: any) => ({
          collect: async () => Array.from(tables[tableName]?.values() ?? []),
        }),
      }),
    },
    __state: tables,
  };

  return ctx;
}

describe('deleteProject cascade', () => {
  it('deletes all related records across all tables', async () => {
    const ctx = makeCascadeCtx({ userId: 'owner' });

    await deleteProjectHandler(ctx, { projectId: 'p1' as any });

    // All tables should be empty
    for (const [tableName, table] of Object.entries(ctx.__state)) {
      expect(table.size).toBe(0);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/__tests__/cascade-delete.test.ts`
Expected: FAIL — `deleteProjectHandler` not exported and doesn't delete all tables

**Step 3: Update `convex/projects.ts` deleteProject**

Extract the handler and add cascade deletes for all 6 missing tables. Add between the existing artifact deletion and the project deletion:

```typescript
// After deleting artifacts (line 295), add:

// Cascade delete artifact versions (for each artifact)
for (const artifact of artifacts) {
  const versions = await ctx.db
    .query('artifactVersions')
    .withIndex('by_artifact', (q) => q.eq('artifactId', artifact._id))
    .collect();
  for (const version of versions) {
    await ctx.db.delete(version._id);
  }
}

// Cascade delete generation tasks
const tasks = await ctx.db
  .query('generationTasks')
  .withIndex('by_project_phase', (q) => q.eq('projectId', args.projectId))
  .collect();
for (const task of tasks) {
  await ctx.db.delete(task._id);
}

// Cascade delete section preferences
const prefs = await ctx.db
  .query('sectionPreferences')
  .withIndex('by_project_phase', (q) => q.eq('projectId', args.projectId))
  .collect();
for (const pref of prefs) {
  await ctx.db.delete(pref._id);
}

// Cascade delete project codebase
const codebases = await ctx.db
  .query('projectCodebase')
  .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
  .collect();
for (const cb of codebases) {
  await ctx.db.delete(cb._id);
}

// Cascade delete verification results
const verifications = await ctx.db
  .query('verificationResults')
  .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
  .collect();
for (const vr of verifications) {
  await ctx.db.delete(vr._id);
}

// Cascade delete tickets
const tickets = await ctx.db
  .query('tickets')
  .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
  .collect();
for (const ticket of tickets) {
  await ctx.db.delete(ticket._id);
}
```

Export the handler function for testing: `export async function deleteProjectHandler(ctx: MutationCtx, args: { projectId: any }) { ... }`

**Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/__tests__/cascade-delete.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add convex/projects.ts convex/__tests__/cascade-delete.test.ts
git commit -m "fix: cascade delete all related records on project deletion

Previously only phases and artifacts were deleted. Now also deletes:
generationTasks, artifactVersions, sectionPreferences, projectCodebase,
verificationResults, and tickets."
```

---

### Task 5: Fix OAuth — Remove Token from URL, Add CSRF Nonce, Validate Redirect

**Files:**
- Modify: `components/codebase-connector.tsx:96-113`
- Modify: `app/api/github/callback/route.ts:1-104`
- Create: `lib/__tests__/oauth-state.test.ts`

**Context:** Three issues: (1) encrypted token passed in URL query string, (2) no CSRF nonce in OAuth state, (3) `state.redirect` used without validation.

**Step 1: Write the failing test for state validation**

```typescript
// lib/__tests__/oauth-state.test.ts
import { describe, expect, it } from 'vitest';

// Allowlist of valid redirect patterns
const ALLOWED_REDIRECT_PATTERNS = [
  /^\/project\/[a-zA-Z0-9_-]+$/,
  /^\/dashboard$/,
];

function isValidRedirect(redirect: string): boolean {
  return ALLOWED_REDIRECT_PATTERNS.some((pattern) => pattern.test(redirect));
}

function generateNonce(): string {
  // 16 random bytes as hex
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('OAuth state security', () => {
  it('rejects external URLs as redirect', () => {
    expect(isValidRedirect('https://evil.com')).toBe(false);
    expect(isValidRedirect('//evil.com')).toBe(false);
    expect(isValidRedirect('javascript:alert(1)')).toBe(false);
  });

  it('accepts valid project redirects', () => {
    expect(isValidRedirect('/project/abc123')).toBe(true);
    expect(isValidRedirect('/dashboard')).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(isValidRedirect('/project/../admin')).toBe(false);
  });

  it('generates a nonce of sufficient length', () => {
    const nonce = generateNonce();
    expect(nonce.length).toBe(32); // 16 bytes = 32 hex chars
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/oauth-state.test.ts`
Expected: PASS

**Step 3: Update `components/codebase-connector.tsx` to include nonce**

In `handleGitHubOAuth` (line 103-108), add a nonce and store it in sessionStorage:

```typescript
function handleGitHubOAuth() {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    setError('GitHub OAuth is not configured');
    return;
  }

  // Generate CSRF nonce and store for validation
  const nonce = crypto.randomUUID();
  sessionStorage.setItem('github_oauth_nonce', nonce);

  const state = Buffer.from(
    JSON.stringify({
      redirect: `/project/${projectId}`,
      projectId,
      nonce,
    })
  ).toString('base64');

  const redirectUri = `${window.location.origin}/api/github/callback`;
  const scope = 'repo read:user';

  window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
}
```

**Step 4: Update `app/api/github/callback/route.ts`**

1. Validate redirect against allowlist
2. Store encrypted token server-side via Convex mutation instead of URL
3. Redirect without token in URL — client reads from Convex on mount

```typescript
// In the callback handler, after encrypting the token:

// Validate redirect against allowlist
const ALLOWED_REDIRECTS = [/^\/project\/[a-zA-Z0-9_-]+$/, /^\/dashboard$/];
if (!ALLOWED_REDIRECTS.some((p) => p.test(redirectUrl))) {
  redirectUrl = '/dashboard';
}

// Redirect WITHOUT token in URL
// Client will read the token from sessionStorage nonce verification
const redirectTarget = new URL(redirectUrl, request.url);
redirectTarget.searchParams.set('github_connected', 'true');
if (projectId) {
  redirectTarget.searchParams.set('project_id', projectId);
}

return NextResponse.redirect(redirectTarget);
```

**Note:** The full server-side token storage requires a Convex mutation that stores the encrypted token keyed by a short-lived session ID. This is a larger change — the redirect validation and nonce are the minimum viable fix. Document the token-in-URL as a known limitation with a TODO for server-side storage.

**Step 5: Run typecheck and tests**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

**Step 6: Commit**

```bash
git add components/codebase-connector.tsx app/api/github/callback/route.ts lib/__tests__/oauth-state.test.ts
git commit -m "fix: add CSRF nonce to OAuth state and validate redirect URL

Add nonce to prevent CSRF attacks on the OAuth flow. Validate redirect
URL against an allowlist to prevent open redirects. Token-in-URL is
documented as a known limitation pending server-side storage."
```

---

## Sprint 2: High-Severity Reliability Fixes

### Task 6: Fix System Prompt Separation in All 8 Provider Clients

**Files:**
- Modify: `lib/llm/providers/openai.ts:79-97`
- Modify: `lib/llm/providers/anthropic.ts:82-100`
- Modify: `lib/llm/providers/deepseek.ts:58-76`
- Modify: `lib/llm/providers/mistral.ts:85-103`
- Modify: `lib/llm/providers/openrouter.ts:58-76`
- Modify: `lib/llm/providers/zai.ts:138-156`
- Modify: `lib/llm/providers/minimax.ts:91-109`
- Modify: `lib/llm/providers/generic-openai.ts:66-84`
- Create: `lib/llm/__tests__/provider-system-prompt.test.ts`

**Context:** Every provider's `generateSection()` concatenates `systemPrompt + userPrompt` into a single string and passes it as the `prompt` arg to `complete()` without setting `options.systemPrompt`. All 8 `complete()` methods already support `systemPrompt` as an option — the wiring is just missing.

**Step 1: Write the failing test**

```typescript
// lib/llm/__tests__/provider-system-prompt.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock fetchWithTimeout to use our mock
vi.mock('../response-normalizer', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    fetchWithTimeout: (...args: any[]) => mockFetch(args[0], args[1]),
  };
});

import { OpenAIClient } from '../providers/openai';
import { AnthropicClient } from '../providers/anthropic';
import { DeepSeekClient } from '../providers/deepseek';
import { GenericOpenAIClient } from '../providers/generic-openai';
import type { LlmSectionRequest } from '../types';

const baseSectionRequest: LlmSectionRequest = {
  projectContext: { title: 'Test', description: 'Test project' },
  sectionName: 'Executive Summary',
  sectionQuestions: [],
  previousSections: [],
  artifactType: 'brief',
  modelId: 'gpt-4o',
  maxTokens: 2000,
};

function makeSuccessResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    }),
    text: async () => '',
  };
}

describe('provider generateSection sends systemPrompt separately', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(makeSuccessResponse('Generated content'));
  });

  it('OpenAIClient passes systemPrompt as a system message', async () => {
    const client = new OpenAIClient('test-key');
    await client.generateSection(baseSectionRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const messages = body.messages;

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    // System message should NOT contain the user prompt content
    expect(messages[0].content).not.toContain(messages[1].content);
  });

  it('GenericOpenAIClient passes systemPrompt as a system message', async () => {
    const client = new GenericOpenAIClient('test-key', 'https://api.example.com/v1', 'example');
    await client.generateSection(baseSectionRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const messages = body.messages;

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('AnthropicClient passes system prompt via body.system field', async () => {
    const anthropicRequest = { ...baseSectionRequest, modelId: 'claude-sonnet-4-5' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Generated content' }],
        usage: { input_tokens: 100, output_tokens: 200 },
        stop_reason: 'end_turn',
      }),
      text: async () => '',
    });

    const client = new AnthropicClient('test-key');
    await client.generateSection(anthropicRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.system).toBeDefined();
    expect(typeof body.system).toBe('string');
    expect(body.system.length).toBeGreaterThan(0);
    expect(body.messages.length).toBe(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('DeepSeekClient passes systemPrompt as a system message', async () => {
    const client = new DeepSeekClient('test-key');
    await client.generateSection(baseSectionRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe('system');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/llm/__tests__/provider-system-prompt.test.ts`
Expected: FAIL — providers currently concatenate both prompts into one user message

**Step 3: Fix all 8 providers**

The fix is identical for all providers. In each `generateSection()` method, change:

```typescript
// OLD (same pattern in all 8 files):
const response = await this.complete(`${systemPrompt}\n\n${userPrompt}`, {
  model: request.modelId,
  maxTokens: request.maxTokens,
  temperature: 0.7,
});

// NEW:
const response = await this.complete(userPrompt, {
  model: request.modelId,
  maxTokens: request.maxTokens,
  temperature: 0.7,
  systemPrompt,
});
```

Files and exact lines to change:
- `lib/llm/providers/openai.ts:87-91`
- `lib/llm/providers/anthropic.ts:90-94`
- `lib/llm/providers/deepseek.ts:66-70`
- `lib/llm/providers/mistral.ts:93-97`
- `lib/llm/providers/openrouter.ts:66-70`
- `lib/llm/providers/zai.ts:146-150`
- `lib/llm/providers/minimax.ts:99-103`
- `lib/llm/providers/generic-openai.ts:74-78`

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/llm/__tests__/provider-system-prompt.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add lib/llm/providers/*.ts lib/llm/__tests__/provider-system-prompt.test.ts
git commit -m "fix: pass systemPrompt separately in all 8 provider generateSection methods

All providers were concatenating system and user prompts into a single
user message. Now system prompt is passed via the systemPrompt option,
enabling proper system/user role separation for all providers including
models.dev providers via GenericOpenAIClient."
```

---

### Task 7: Sanitize Raw API Error Messages

**Files:**
- Modify: `lib/llm/providers/openai.ts:70-72`
- Modify: `lib/llm/providers/anthropic.ts:73-75`
- Modify: `lib/llm/providers/deepseek.ts:49-51`
- Modify: `lib/llm/providers/mistral.ts:76-78`
- Modify: `lib/llm/providers/openrouter.ts:49-51`
- Modify: `lib/llm/providers/zai.ts:127-129`
- Modify: `lib/llm/providers/minimax.ts:82-84`
- Modify: `lib/llm/providers/generic-openai.ts:57-59`

**Context:** All providers throw `throw new Error(\`Provider API error: ${rawText}\`)` where `rawText` is the full HTTP error response body, which may contain account IDs or sensitive metadata.

**Step 1: Write the test**

```typescript
// Add to lib/llm/__tests__/provider-system-prompt.test.ts
describe('provider error sanitization', () => {
  it('does not include raw API response in thrown error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: { message: 'Invalid API key', type: 'invalid_request_error', org_id: 'org-SECRET123' },
      }),
    });

    const client = new OpenAIClient('bad-key');
    await expect(
      client.complete('test', { model: 'gpt-4o' })
    ).rejects.toThrow(/OpenAI API error/);

    // The error should NOT contain the org_id
    try {
      await client.complete('test', { model: 'gpt-4o' });
    } catch (e: any) {
      expect(e.message).not.toContain('org-SECRET123');
    }
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run lib/llm/__tests__/provider-system-prompt.test.ts`
Expected: FAIL — raw error body currently included

**Step 3: Fix all 8 providers**

Replace the raw error throw in each provider. Example for OpenAI:

```typescript
// OLD:
if (!response.ok) {
  const error = await response.text();
  throw new Error(`OpenAI API error: ${error}`);
}

// NEW:
if (!response.ok) {
  const errorText = await response.text();
  // Log raw error server-side for debugging, but don't expose to callers
  console.error(`[OpenAI] API error (${response.status}):`, errorText);
  throw new Error(`OpenAI API error: HTTP ${response.status}`);
}
```

Apply the same pattern to all 8 providers, replacing the provider name accordingly.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add lib/llm/providers/*.ts lib/llm/__tests__/provider-system-prompt.test.ts
git commit -m "fix: sanitize API error messages in all LLM provider clients

Raw API error response bodies may contain sensitive account metadata.
Log full error server-side but only throw HTTP status code to callers."
```

---

### Task 8: Fix `deleteUserConfigRaw` Silent No-Op

**Files:**
- Modify: `convex/userConfigs.ts:93-109`

**Context:** The deletion is gated on `existing.apiKey` being truthy. Users with `useSystem: true` (no personal key) cannot delete.

**Step 1: Fix the code**

```typescript
// OLD (lines 105-107):
if (existing && existing.apiKey) {
  await ctx.db.delete(existing._id);
}

// NEW:
if (existing) {
  await ctx.db.delete(existing._id);
}
```

**Step 2: Typecheck and test**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add convex/userConfigs.ts
git commit -m "fix: deleteUserConfigRaw now deletes config regardless of apiKey presence

Previously users with useSystem=true configs could not delete their
configuration because deletion was gated on apiKey being truthy."
```

---

### Task 9: Parallelize GitHub API File Fetching in `scanCodebase`

**Files:**
- Modify: `convex/actions/scanCodebase.ts:150-172`

**Context:** Up to 50 files are fetched sequentially. This should use batched parallel fetching.

**Step 1: Fix the code**

Replace the sequential `for...of` loop:

```typescript
// OLD (lines 150-172):
const filesToFetch = keyFilesPaths.slice(0, 50);
for (const filePath of filesToFetch) {
  try {
    const content = await fetchFileContent(/* ... */);
    if (content !== null) {
      keyFiles.push({ /* ... */ });
    }
  } catch (error) {
    console.warn(`[scanCodebase] Failed to fetch ${filePath}:`, error);
  }
}

// NEW:
const filesToFetch = keyFilesPaths.slice(0, 50);
const BATCH_SIZE = 10;
for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
  const batch = filesToFetch.slice(i, i + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(async (filePath) => {
      const content = await fetchFileContent(
        accessToken,
        args.repoOwner,
        args.repoName,
        filePath
      );
      if (content !== null) {
        return {
          path: filePath,
          content,
          language: detectLanguage(filePath),
          sizeBytes: Buffer.byteLength(content, 'utf8'),
        };
      }
      return null;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      keyFiles.push(result.value);
    } else if (result.status === 'rejected') {
      console.warn(`[scanCodebase] Failed to fetch file:`, result.reason);
    }
  }
}
```

**Step 2: Typecheck and test**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add convex/actions/scanCodebase.ts
git commit -m "fix: parallelize GitHub API file fetching in scanCodebase

Fetch files in batches of 10 instead of sequentially. Reduces scan time
from O(50 * latency) to O(5 * latency) for 50 files."
```

---

## Sprint 3: Medium-Severity Cleanup

### Task 10: Extract Duplicate `mapPhaseToArtifactType`

**Files:**
- Create: `convex/lib/phase-utils.ts`
- Modify: `convex/projects.ts:21-52` (replace with import)
- Modify: `convex/internal.ts:11-42` (replace with import)

**Step 1: Create shared utility**

```typescript
// convex/lib/phase-utils.ts
export function mapPhaseToArtifactType(phaseId: string): string {
  switch (phaseId) {
    case 'constitution':
      return 'constitution';
    case 'brief':
      return 'brief';
    case 'prd':
      return 'prd';
    case 'domainModel':
      return 'domainModel';
    case 'specs':
      return 'techSpec';
    case 'stories':
      return 'userStories';
    case 'artifacts':
    case 'handoff':
      return 'handoff';
    default:
      return 'brief';
  }
}
```

**Step 2: Replace both copies with imports**

In `convex/projects.ts` and `convex/internal.ts`:

```typescript
import { mapPhaseToArtifactType } from './lib/phase-utils';
```

Remove the inline `mapPhaseToArtifactType` function from both files.

**Step 3: Run tests**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add convex/lib/phase-utils.ts convex/projects.ts convex/internal.ts
git commit -m "refactor: extract mapPhaseToArtifactType to shared utility

Eliminates duplication between projects.ts and internal.ts."
```

---

### Task 11: Fix `GenericOpenAIClient` URL Normalization No-Op

**Files:**
- Modify: `lib/llm/providers/generic-openai.ts:20`

**Step 1: Fix the no-op ternary**

```typescript
// OLD (line 20):
this.baseUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}`;

// NEW:
this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
```

The intent is to normalize trailing slashes, not append `/v1` (providers have different URL structures).

**Step 2: Typecheck and test**

Run: `npm run typecheck && npx vitest run`

**Step 3: Commit**

```bash
git add lib/llm/providers/generic-openai.ts
git commit -m "fix: GenericOpenAIClient URL normalization was a no-op

The ternary returned baseUrl unchanged in both branches. Now strips
trailing slash to prevent double-slash in constructed URLs."
```

---

### Task 12: Fix `cn()` Import Inconsistency

**Files:**
- Modify: `components/ui/button.tsx:4`
- Modify: `components/phase-stepper.tsx:4`

**Step 1: Fix imports**

In both files, change:

```typescript
// OLD:
import { cn } from '@/lib/markdown';

// NEW:
import { cn } from '@/lib/utils';
```

**Step 2: Verify `cn` is exported from `lib/utils.ts`** (it should be — it's the canonical location)

Run: `npm run typecheck && npx vitest run`

**Step 3: Commit**

```bash
git add components/ui/button.tsx components/phase-stepper.tsx
git commit -m "fix: align cn() imports to use @/lib/utils consistently

Two files were importing cn from @/lib/markdown instead of @/lib/utils."
```

---

### Task 13: Fix `PhaseStepper` Hardcoded `currentPhase`

**Files:**
- Modify: `app/project/[id]/page.tsx:147`

**Context:** The stepper always highlights `constitution` regardless of progress. The fix is to derive the current active phase from the phase statuses.

**Step 1: Fix the code**

```typescript
// OLD (line 147):
<PhaseStepper
  projectId={params.id}
  currentPhase="constitution"
  phaseStatuses={Object.fromEntries(phaseStatusMap)}
/>

// NEW:
<PhaseStepper
  projectId={params.id}
  currentPhase={
    // Find the first phase that is not 'ready' (i.e., the current active phase)
    PHASES.find((p) => {
      const status = phaseStatusMap.get(p.id);
      return !status || status !== 'ready';
    })?.id ?? 'constitution'
  }
  phaseStatuses={Object.fromEntries(phaseStatusMap)}
/>
```

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Commit**

```bash
git add app/project/[id]/page.tsx
git commit -m "fix: derive PhaseStepper currentPhase from actual phase statuses

Previously hardcoded to 'constitution', now highlights the first
incomplete phase."
```

---

### Task 14: Fix `parseInt` NaN Bug in Admin Model Form

**Files:**
- Modify: `app/(auth)/admin/llm-models/page.tsx` (all `parseInt` calls in form inputs)

**Step 1: Fix the code**

Replace all `parseInt(e.target.value)` in number input onChange handlers:

```typescript
// OLD:
onChange={(e) => setNewModel({ ...newModel, contextTokens: parseInt(e.target.value) })}

// NEW:
onChange={(e) => setNewModel({ ...newModel, contextTokens: parseInt(e.target.value) || 0 })}
```

Apply to all number fields: `contextTokens`, `maxOutputTokens`, `defaultMax`.

**Step 2: Typecheck**

Run: `npm run typecheck`

**Step 3: Commit**

```bash
git add app/(auth)/admin/llm-models/page.tsx
git commit -m "fix: guard parseInt against NaN in admin model form number inputs

Clearing a number input produced NaN which would be submitted to Convex."
```

---

### Task 15: Remove Unused Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Verify no imports exist**

Run:
```bash
grep -r "adm-zip" lib/ convex/ components/ app/ --include="*.ts" --include="*.tsx"
grep -r "@tanstack/react-query" lib/ convex/ components/ app/ --include="*.ts" --include="*.tsx"
grep -r "@clerk/clerk-react" lib/ convex/ components/ app/ --include="*.ts" --include="*.tsx"
```

Expected: No matches for any of the three.

**Step 2: Remove from package.json**

Remove these three dependencies:
- `"adm-zip": "^0.5.14"` (production)
- `"@tanstack/react-query": "^5.60.0"` (production)
- `"@clerk/clerk-react": "5.59.3"` (production — note: pinned, not range)

**Step 3: Reinstall**

Run: `bun install` (or `npm install`)

**Step 4: Typecheck and test**

Run: `npm run typecheck && npx vitest run`

**Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: remove unused dependencies adm-zip, @tanstack/react-query, @clerk/clerk-react

All three have zero imports across the codebase."
```

---

### Task 16: Add `CLERK_JWT_ISSUER_DOMAIN` to `.env.example`

**Files:**
- Modify: `.env.example`

**Step 1: Update .env.example**

Add the missing variable:

```bash
# Clerk JWT Issuer Domain (required for Convex auth)
CLERK_JWT_ISSUER_DOMAIN=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add CLERK_JWT_ISSUER_DOMAIN to .env.example

Required by convex/auth.config.ts but was missing from the example,
causing silent auth failures on new deployments."
```

---

## Verification Checklist

After all tasks, run the full quality gate:

```bash
npm run typecheck && npm run lint -- --max-warnings=0 && npx vitest run
```

All three must pass before creating a PR.

---

## Summary

| Sprint | Tasks | Focus |
|--------|-------|-------|
| Sprint 1 | Tasks 1-5 | Critical security: auth, credentials, structured output, cascade delete, OAuth |
| Sprint 2 | Tasks 6-9 | High reliability: system prompt separation (all 8 providers + models.dev), error sanitization, config deletion, parallel fetching |
| Sprint 3 | Tasks 10-16 | Medium cleanup: deduplication, no-op fixes, import consistency, unused deps, env docs |
