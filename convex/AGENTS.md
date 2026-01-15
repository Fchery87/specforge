# convex/ AGENTS.md

## Package Identity

Backend functions for SpecForge using Convex (serverless backend). Handles project/phase storage, LLM integrations, generation tasks, and credential management.

## Setup & Run

Convex runs alongside the Next.js dev server:

```bash
# Start Convex dev (separate terminal)
npm run convex

# Typecheck Convex
npx tsc convex/tsconfig.json --noEmit
```

## Patterns & Conventions

### File Organization
- **Actions**: `convex/actions/*.ts` (API endpoints)
- **Database logic**: `convex/*.ts` (schema, internal queries)
- **Helpers**: `convex/lib/*.ts`
- **Tests**: `convex/__tests__/*.test.ts`

### Naming Conventions
- Actions: `export const actionName = action({ args: {...}, handler: ... })`
- Queries: `export const queryName = query({ args: {...}, handler: ... })`
- Internal API: Use `internal` namespace to bypass auth (see `internal.ts`)

### Preferred Patterns

**1. Action with validation:**
```typescript
// ✅ DO: Follow convex/actions/generatePhase.ts pattern
'use node';
import { action } from '../_generated/server';
import { v } from 'convex/values';

export const myAction = action({
  args: {
    projectId: v.id('projects'),
    someField: v.string(),
  },
  handler: async (ctx, args) => {
    // Implementation
  },
});
```

**2. Internal query (bypasses auth):**
```typescript
// ✅ DO: Follow convex/internal.ts pattern
export const getProjectInternal = internalQuery({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});
```

**3. Internal action (for workers):**
```typescript
// ✅ DO: Follow convex/internalActions.ts pattern
export const myInternalAction = internalAction({
  args: { ... },
  handler: async (ctx, args) => {
    // Can call external APIs, etc.
  },
});
```

**4. Database schema:**
```typescript
// ✅ DO: Follow convex/schema.ts pattern
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    // ...
  }).index('by_user', ['userId']),
});
```

**5. Auth in actions:**
```typescript
// ✅ DO: Use ctx.auth.getUserIdentity()
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error('Unauthorized');
if (identity.subject !== project.userId) throw new Error('Forbidden');
```

**6. Rate limiting:**
```typescript
// ✅ DO: Use convex/rateLimiter.ts
import { rateLimiter } from '../rateLimiter';
await rateLimiter(ctx, { key: userId });
```

### ❌ DON'T
- ❌ Skip args validation (always use `v.*` validators)
- ❌ Use Convex context (`ctx`) outside Convex functions
- ❌ Call external APIs in regular actions without rate limiting
- ❌ Expose sensitive data in query results without authorization checks
- ❌ Forget to index fields used in queries

## Touch Points / Key Files

- **Schema**: `convex/schema.ts`
- **Auth config**: `convex/auth.config.ts`
- **Rate limiter**: `convex/rateLimiter.ts`
- **Internal queries**: `convex/internal.ts`
- **Generation action**: `convex/actions/generatePhase.ts`
- **Credential management**: `convex/systemCredentials.ts`, `convex/userConfigs.ts`
- **LLM models config**: `convex/llmModels.ts`

## JIT Index Hints

```bash
# Find actions
rg -n "export const.*= action" convex/

# Find queries
rg -n "export const.*= query" convex/

# Find internal API
rg -n "internalQuery\|internalAction" convex/

# Find schema definitions
rg -n "defineTable" convex/

# Find test files
find convex -name "*.test.ts"
```

## Common Gotchas

- **'use node'**: Required at top of files using Node.js APIs or external calls
- **Auth bypass**: Internal queries/actions skip Clerk auth - use carefully
- **Encryption**: API keys stored encrypted via `lib/encryption.ts`
- **Generation tasks**: Use `generationTasks` table for long-running operations
- **Id types**: Use `v.id('tableName')` for document IDs, not `v.string()`

## Pre-PR Checks

```bash
npm run convex  # Ensure Convex types compile
npx tsc convex/tsconfig.json --noEmit
```
