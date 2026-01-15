# lib/ CLAUDE.md

**Technology**: TypeScript, Node.js (some modules), LLM integration
**Parent Context**: Extends [../CLAUDE.md](../CLAUDE.md)

## Development Commands

```bash
# Typecheck
npm run typecheck

# Run lib tests
npm test -- lib/__tests__/

# Run LLM tests specifically
npm test -- lib/llm/__tests__/
```

## Architecture

### Directory Structure
```
lib/
├── *.ts                    # Utilities (encryption, notifications, utils)
├── llm/                    # LLM integration
│   ├── registry.ts         # Model registry (IMPORTANT)
│   ├── client-factory.ts   # LLM client creation
│   ├── chunking.ts         # Context chunking
│   ├── types.ts            # LLM type definitions
│   ├── retry.ts            # Retry logic
│   ├── continuation.ts     # Response continuation
│   ├── providers/          # Provider-specific code
│   └── __tests__/          # LLM tests
└── __tests__/              # Utility tests
```

### Code Organization Patterns

#### Utilities
- **DO**: Follow `lib/utils.ts` pattern for utilities
  - Export with JSDoc comments
  - Use proper TypeScript types
- **DON'T**: Mix concerns in utility files

#### Encryption
- **DO**: Follow `lib/encryption.ts` pattern
  - Use for storing API keys in Convex
  - Pattern: `encrypt(data, password)`, `decrypt(encrypted, password)`

#### Notifications
- **DO**: Follow `lib/notifications.ts` pattern
  - Use sonner for toasts
  - Pattern: `showToast()`, `TOASTMessages`

#### LLM Client
- **DO**: Use `lib/llm/client-factory.ts` for creating clients
  ```typescript
  import { createLlmClient } from './llm/client-factory';
  import type { LlmModel, ProviderCredentials } from './llm/types';
  const client = createLlmClient(model, credentials);
  ```

#### Model Registry
- **DO**: Reference `lib/llm/registry.ts` for all available models
  - Contains: OpenAI, Anthropic, DeepSeek, Z.AI, Minimax
  - Pattern: `MODEL_REGISTRY` array with `RegistryEntry`

#### Chunking
- **DO**: Use `lib/llm/chunking.ts` for context management
  - Functions: `planSections`, `expandSectionsForBudget`, `estimateTokenCount`

#### Retry Logic
- **DO**: Use `lib/llm/retry.ts` for resilient API calls
  - Pattern: `retryWithBackoff(fn, retries, delay)`

#### Types
- **DO**: Use types from `lib/llm/types.ts`
  - `LlmModel`, `ProviderCredentials`, `UserConfig`

### ❌ DON'T
- **DON'T** import server-only code (`'use node'`) in client components
- **DON'T** hardcode API keys - use environment or Convex-stored credentials
- **DON'T** use `any` types - use proper types from `lib/llm/types.ts`
- **DON'T** import Convex server code (`_generated/server`) outside Convex

## Key Files

### Types & Configuration
- `lib/llm/types.ts` - LLM type definitions
- `lib/llm/registry.ts` - Model registry (all providers)
- `lib/llm/artifact-types.ts` - Artifact type definitions

### Client & Integration
- `lib/llm/client-factory.ts` - Create LLM clients
- `lib/llm/providers/` - Provider-specific implementations
- `lib/llm/response-normalizer.ts` - Normalize LLM responses

### Utilities
- `lib/utils.ts` - Common utilities (`cn`, `debounce`, `formatBytes`)
- `lib/encryption.ts` - Encryption for credentials
- `lib/notifications.ts` - Toast notifications
- `lib/batch-answers.ts` - Batch answer handling

### Data Processing
- `lib/llm/chunking.ts` - Context chunking
- `lib/llm/continuation.ts` - Handle truncated responses
- `lib/llm/retry.ts` - Retry with backoff
- `lib/markdown-render.ts` - Markdown to HTML

### Auth & Config
- `lib/auth.tsx` - Auth utilities
- `lib/authz.ts` - Authorization helpers
- `lib/user-config.ts` - User configuration

## Quick Search Commands

```bash
# Find LLM models
rg -n "MODEL_REGISTRY" lib/llm/

# Find types
rg -n "export (interface|type)" lib/llm/

# Find providers
ls lib/llm/providers/

# Find test files
find lib -name "*.test.ts"

# Find utilities
rg -n "export (function|const)" lib/*.ts

# Find encryption usage
rg -n "encrypt|decrypt" lib/

# Find toast notifications
rg -n "toast|showToast" lib/
```

## Common Gotchas

- **Server vs Client**: Some utilities (`encryption.ts`) are Node-only
- **LLM credentials**: Can be user-provided or system-wide (stored in Convex)
- **Environment variables**: Use `process.env.NEXT_PUBLIC_*` for client-side
- **Model selection**: Use `selectEnabledModels()` to filter enabled models
- **Token estimation**: Use `estimateTokenCount()` for chunking decisions

## Pre-PR Checklist

```bash
npm run typecheck
npm test -- lib/__tests__/
npm test -- lib/llm/__tests__/
```
