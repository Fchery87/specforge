# CLAUDE.md - SpecForge Development Guide

## Overview
- **Type**: Standard single-project Next.js application
- **Stack**: Next.js 16 (App Router), TypeScript, Convex, Clerk, Tailwind CSS, Vitest, Radix UI, Framer Motion
- **Architecture**: AI-powered software specification generator with LLM integrations

This CLAUDE.md is the authoritative source for development guidelines. Subdirectories contain specialized CLAUDE.md files that extend these rules.

## Universal Development Rules

### Code Quality (MUST)
- **MUST** write TypeScript in strict mode
- **MUST** include tests for all new features (colocated `*.test.ts*`)
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

## Core Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run convex           # Start Convex dev (separate terminal)

# Quality
npm run typecheck        # TypeScript validation
npm run lint             # ESLint all code
npm run lint -- --max-warnings=0  # Strict lint
npm run test             # Run all tests
npm run test:coverage    # Run tests with coverage

# Build
npm run build            # Production build
npm run start            # Start production server

# Pre-PR Quality Gate
npm run typecheck && npm run lint -- --max-warnings=0 && npm run test
```

## Project Structure

### Directories
- **`app/`** - Next.js App Router pages and API routes
- **`components/`** - React UI components ([see components/CLAUDE.md](components/CLAUDE.md))
  - `ui/` - Design system primitives (Radix UI + Tailwind)
  - `__tests__/` - Component tests
- **`convex/`** - Serverless backend ([see convex/CLAUDE.md](convex/CLAUDE.md))
  - `actions/` - API endpoints
  - `__tests__/` - Backend tests
- **`lib/`** - Utilities and LLM integration ([see lib/CLAUDE.md](lib/CLAUDE.md))
  - `llm/` - LLM providers, registry, chunking
  - `__tests__/` - Utility tests

### Key Files
- `middleware.ts` - Clerk authentication middleware
- `convex/schema.ts` - Database schema
- `lib/llm/registry.ts` - LLM model registry
- `lib/encryption.ts` - Credential encryption

## Quick Find Commands

```bash
# Find React components
rg -n "export (function|const) .*=" components/

# Find Convex actions
rg -n "export const.*= action" convex/

# Find Convex queries
rg -n "export const.*= query" convex/

# Find LLM models
rg -n "MODEL_REGISTRY" lib/llm/

# Find tests
rg -l "describe|test\(" --glob "*.test.ts*"

# Find API routes
rg -n "export async function (GET|POST)" app/

# Find types
rg -n "export (interface|type)" lib/llm/
```

## Security Guidelines

- **NEVER** commit tokens, API keys, or credentials
- **NEVER** edit `.env.local` or `.env.example` without confirmation
- LLM credentials are stored encrypted in Convex DB
- Use environment variables for all secrets
- PII must be redacted in logs

## Git Workflow

- Branch from `main` for features: `feature/description`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`
- PRs require: passing tests, type checks, lint, and 1 approval
- Squash commits on merge, delete branches after merge

## Testing Requirements

- **Unit tests**: All business logic - aim for >80% coverage
- **Framework**: Vitest + React Testing Library
- **Location**: Colocated `*.test.ts*` or `__tests__/` folder
- Run tests before committing (hooks enforce this)

## Available Tools

- Standard bash tools (rg, git, node, npm)
- Convex CLI (`npx convex`)
- Testing tools (vitest)
- GitHub CLI (`gh`) - when installed

### Tool Permissions
- ✅ Read any file
- ✅ Write code files
- ✅ Run tests, linters, type checkers
- ❌ Edit .env files (ask first)
- ❌ Force push (ask first)
- ❌ Delete Convex database (ask first)

## Specialized Context

When working in specific areas, refer to their CLAUDE.md:
- UI components: [components/CLAUDE.md](components/CLAUDE.md)
- Backend/Convex: [convex/CLAUDE.md](convex/CLAUDE.md)
- Utilities/LLM: [lib/CLAUDE.md](lib/CLAUDE.md)
