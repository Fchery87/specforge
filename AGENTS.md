# AGENTS.md - SpecForge AI Development Guide

## Project Snapshot

SpecForge is a **single-project Next.js application** that uses AI to generate software specifications from user requirements. Stack: Next.js 16 (App Router), TypeScript, Convex (backend), Clerk (auth), Tailwind CSS, Vitest.

For details on specific areas, see the sub-folder guides below.

## Root Setup Commands

```bash
# Install dependencies (npm only, Node >=20.9, Node 22 recommended via .nvmrc)
npm ci

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
- Auth: `proxy.ts` (Clerk), per-section layouts call `auth.protect()`
- Schema: `convex/schema.ts`
- Schema Extractor & Validator Engine: `lib/schema/phase-schema-extractor.ts`
- In-Browser Artifact Editor: `components/artifact-editor-modal.tsx`
- Monaco-Style Schema Validator Panel: `components/schema-validator-panel.tsx`
- Stress-Test Grilling Modal: `components/stress-test-modal.tsx`
- Ticket Parser & Tracer Bullet Extractor: `lib/ticket-parser.ts`

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

## Authoritative Rules (merged from CLAUDE.md, single source per directory)

### Code Quality (MUST)
- **MUST** write TypeScript in strict mode
- **MUST** include tests for all new features (co-located `*.test.ts*`)
- **MUST** run lint and typecheck before committing
- **MUST NOT** commit secrets, API keys, or tokens

### Best Practices (SHOULD)
- **SHOULD** use functional React components with hooks
- **SHOULD** use descriptive variable names (no single letters except loops)
- **SHOULD** keep functions under 50 lines
- **SHOULD** use `@/` alias for absolute imports

### Anti-Patterns (MUST NOT)
- **MUST NOT** use `any` type without explicit justification
- **MUST NOT** use `@ts-ignore` to bypass TypeScript errors
- **MUST NOT** push directly to main branch
- **MUST NOT** hardcode colors - use Tailwind classes or CSS variables

### Git Workflow
- Branch from `main` for features: `feature/description`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`
- PRs require: passing tests, type checks, lint, and 1 approval
- Squash commits on merge, delete branches after merge

### Testing Requirements
- **Unit tests**: All business logic - aim for >80% coverage
- **Framework**: Vitest + React Testing Library
- **Location**: Co-located `*.test.ts*` or `__tests__/` folder

### Tool Permissions
- Read any file, write code files, run tests/linters/type checkers
- Ask first: edit `.env` files, force push, delete Convex database
