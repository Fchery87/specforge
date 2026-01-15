# convex/ CLAUDE.md

**Technology**: Convex (serverless backend), TypeScript, Node.js
**Parent Context**: Extends [../CLAUDE.md](../CLAUDE.md)

## Development Commands

```bash
# Start Convex dev server (separate terminal)
npm run convex

# Typecheck Convex
npx tsc convex/tsconfig.json --noEmit

# Run Convex tests
npm test -- convex/__tests__/
```

## Architecture

### Directory Structure
```
convex/
├── actions/              # API endpoints
│   ├── generatePhase.ts  # Main generation action
│   ├── generateQuestions.ts
│   └── generateAllQuestionAnswers.ts
├── *.ts                  # Database logic, internal queries
├── lib/                  # Convex helpers
├── __tests__/            # Backend tests
└── schema.ts             # Database schema
```

### Code Organization Patterns

#### Actions (API Endpoints)
- **DO**: Follow `convex/actions/generatePhase.ts` pattern
  ```typescript
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

#### Queries
- **DO**: Use `query()` for read operations
  ```typescript
  export const myQuery = query({
    args: { id: v.id('table') },
    handler: async (ctx, args) => {
      return await ctx.db.get(args.id);
    },
  });
  ```

#### Internal API (Bypass Auth)
- **DO**: Use `internalQuery`/`internalAction` for worker calls
  - Pattern: `convex/internal.ts`, `convex/internalActions.ts`
  - Use `api.internal.functionName` to call

#### Schema
- **DO**: Follow `convex/schema.ts` pattern
  ```typescript
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

#### Authentication
- **DO**: Use `ctx.auth.getUserIdentity()` in actions
- **DO**: Check `identity.subject === resource.userId` for ownership

#### Rate Limiting
- **DO**: Use `convex/rateLimiter.ts`
  ```typescript
  import { rateLimiter } from '../rateLimiter';
  await rateLimiter(ctx, { key: userId });
  ```

### ❌ DON'T
- **DON'T** skip args validation (always use `v.*` validators)
- **DON'T** use Convex context outside Convex functions
- **DON'T** call external APIs without rate limiting
- **DON'T** expose sensitive data without authorization

## Key Files

### Core
- `convex/schema.ts` - Database schema
- `convex/auth.config.ts` - Auth configuration
- `convex/rateLimiter.ts` - Rate limiting

### Internal API
- `convex/internal.ts` - Internal queries (auth bypass)
- `convex/internalActions.ts` - Internal actions

### Actions
- `convex/actions/generatePhase.ts` - Phase generation (main pattern)
- `convex/actions/generateQuestions.ts` - Question generation
- `convex/actions/generateAllQuestionAnswers.ts` - Batch answers

### Credentials
- `convex/systemCredentials.ts` - System-wide LLM credentials
- `convex/userConfigs.ts` - User LLM configurations

### LLM
- `convex/llmModels.ts` - Enabled LLM models config

## Quick Search Commands

```bash
# Find actions
rg -n "export const.*= action" convex/

# Find queries
rg -n "export const.*= query" convex/

# Find internal API
rg -n "internalQuery|internalAction" convex/

# Find schema tables
rg -n "defineTable" convex/

# Find validators
rg -n "v\.(id|string|number)" convex/

# Find test files
find convex -name "*.test.ts"
```

## Common Gotchas

- **'use node'**: Required at top of files using Node.js APIs or external calls
- **Auth bypass**: Internal queries/actions skip Clerk auth - use carefully
- **Encryption**: API keys stored encrypted via `lib/encryption.ts`
- **Generation tasks**: Use `generationTasks` table for long-running operations
- **Id types**: Use `v.id('tableName')` for document IDs, not `v.string()`
- **Index usage**: Always index fields used in `.index()` queries

## Pre-PR Checklist

```bash
npm run convex &  # Start Convex in background
sleep 5
npx tsc convex/tsconfig.json --noEmit
npm test -- convex/__tests__/
kill %1 2>/dev/null || true
```
