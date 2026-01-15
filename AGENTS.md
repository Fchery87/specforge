# AGENTS.md - SpecForge AI Development Guide

## Project Snapshot

SpecForge is a **single-project Next.js application** that uses AI to generate software specifications from user requirements. Stack: Next.js 16 (App Router), TypeScript, Convex (backend), Clerk (auth), Tailwind CSS, Vitest.

For details on specific areas, see the sub-folder guides below.

## Root Setup Commands

```bash
# Install dependencies
npm install  # or bun install

# Dev server
npm run dev

# Build for production
npm run build

# Typecheck
npm run typecheck

# Lint
npm run lint

# Run tests
npm run test
npm run test:coverage

# Run Convex dev (separate terminal)
npm run convex
```

## Universal Conventions

- **TypeScript**: Strict mode enabled (`strict: true` in tsconfig.json)
- **Formatting**: Prettier not configured, rely on ESLint for code style
- **Imports**: Use `@/` alias for absolute imports (configured in tsconfig.json)
- **Testing**: Vitest with React Testing Library, co-located `*.test.ts*` files
- **Styling**: Tailwind CSS with `cn()` utility from `lib/utils.ts`

## JIT Index (what to open, not what to paste)

### Directory Structure
- **Frontend UI**: `components/` → [see components/AGENTS.md](components/AGENTS.md)
- **Backend/Convex**: `convex/` → [see convex/AGENTS.md](convex/AGENTS.md)
- **Utilities/LLM**: `lib/` → [see lib/AGENTS.md](lib/AGENTS.md)
- **Pages**: `app/` → App Router pages (routes follow file structure)

### Quick Find Commands
- Search for a component: `rg -n "export function|export const.*=" components/`
- Search for a Convex action: `rg -n "export const.*= action" convex/`
- Find API routes: `rg -n "export async function (GET|POST)" app/api/`
- Find tests: `rg -l "describe\|test(" --glob "*.test.ts*"`
- Find LLM provider configs: `rg -n "MODEL_REGISTRY" lib/llm/`

### Key Files
- Types: `lib/llm/types.ts`
- Auth: `middleware.ts` (Clerk)
- Schema: `convex/schema.ts`

## Security & Secrets

- **Never commit secrets** - Use `.env.local` for local development
- **API keys**: Use `CONVEX_` prefix for Convex, `CLERK_` for auth
- **LLM credentials**: Stored encrypted in Convex DB via `lib/encryption.ts`
- **API keys in code**: Never hardcode; use environment variables

## Definition of Done

Before creating a PR:
1. `npm run typecheck` passes
2. `npm run lint` passes (no warnings: `npm run lint --max-warnings=0`)
3. `npm run test` passes
4. No new `any` types introduced (strict mode)
5. Tests for new functionality added
