# lib/ AGENTS.md

## Package Identity

Shared utilities, LLM integration, encryption, and client-side logic. Contains the core AI generation pipeline, provider registry, and system utilities.

## Setup & Run

No separate install - part of the main Next.js application.

```bash
# Typecheck
npm run typecheck

# Run tests
npm run test -- lib/
```

## Patterns & Conventions

### File Organization
- **LLM**: `lib/llm/*` (providers, registry, chunking, types)
- **Utilities**: `lib/*.ts` (encryption, notifications, utils)
- **Tests**: `lib/__tests__/*.test.ts`, `lib/llm/__tests__/*.test.ts`

### Naming Conventions
- Utility functions: camelCase (e.g., `formatBytes`, `debounce`)
- Types/Interfaces: PascalCase (e.g., `LlmModel`, `UserConfig`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `FALLBACK_MODELS`)

### Preferred Patterns

**1. Utility functions with JSDoc:**
```typescript
// ✅ DO: Follow lib/utils.ts pattern
/**
 * Merges clsx and tailwind-merge for class combining
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**2. LLM client creation:**
```typescript
// ✅ DO: Follow lib/llm/client-factory.ts pattern
import { createLlmClient } from './llm/client-factory';
import type { LlmModel, ProviderCredentials } from './llm/types';
// Usage: const client = createLlmClient(model, credentials);
```

**3. Model registry lookup:**
```typescript
// ✅ DO: Follow lib/llm/registry.ts pattern
import { MODEL_REGISTRY, getModelById } from './llm/registry';
// See: lib/llm/registry.ts for all supported models
```

**4. Encryption for credentials:**
```typescript
// ✅ DO: Follow lib/encryption.ts pattern
import { encrypt, decrypt } from './encryption';
// Use for storing API keys in Convex
```

**5. Retry logic:**
```typescript
// ✅ DO: Follow lib/llm/retry.ts pattern
import { retryWithBackoff } from './llm/retry';
```

**6. Chunking for LLM context:**
```typescript
// ✅ DO: Follow lib/llm/chunking.ts pattern
import { planSections, expandSectionsForBudget } from './llm/chunking';
```

**7. Toast notifications:**
```typescript
// ✅ DO: Follow lib/notifications.ts pattern
import { showToast, TOASTMessages } from './notifications';
```

**8. Batch answers for AI:**
```typescript
// ✅ DO: Follow lib/batch-answers.ts pattern
import { saveBatchAnswers, getBatchAnswerPrompt } from './batch-answers';
```

### ❌ DON'T
- ❌ Import server-only code (`'use node'`) in client components
- ❌ Hardcode API keys - use environment or Convex-stored credentials
- ❌ Use `any` types - use proper types from `lib/llm/types.ts`
- ❌ Import Convex server code (`_generated/server`) outside Convex

## Touch Points / Key Files

- **Types**: `lib/llm/types.ts`
- **LLM Registry**: `lib/llm/registry.ts` (all provider models)
- **Client factory**: `lib/llm/client-factory.ts`
- **Chunking strategy**: `lib/llm/chunking.ts`
- **Encryption**: `lib/encryption.ts`
- **Utils**: `lib/utils.ts`
- **Notifications**: `lib/notifications.ts`
- **Auth**: `lib/auth.tsx`, `lib/authz.ts`

## JIT Index Hints

```bash
# Find LLM models
rg -n "MODEL_REGISTRY" lib/llm/

# Find types
rg -n "export interface|export type" lib/llm/

# Find test files
find lib -name "*.test.ts"

# Find utilities
rg -n "export function|export const" lib/*.ts

# Find providers
ls lib/llm/providers/
```

## Common Gotchas

- **Server vs Client**: Some utilities (`encryption.ts`) are Node-only, others work everywhere
- **LLM credentials**: Can be user-provided or system-wide (stored in Convex)
- **Environment variables**: Use `process.env.NEXT_PUBLIC_*` for client-side
- **Model selection**: Use `selectEnabledModels()` to filter enabled models
- **Token estimation**: Use `estimateTokenCount()` for chunking decisions

## Pre-PR Checks

```bash
npm run typecheck
npm run test -- lib/
```
