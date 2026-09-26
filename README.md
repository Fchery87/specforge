# SpecForge - Spec-Driven Project Generator

SpecForge is a high-performance scaffold designed for building repo-native, spec-driven, and LLM-agnostic applications. It provides a solid foundation for generating, previewing, and exporting complex software specifications for engineering teams and AI coding agents.

## Tech Stack

- **Framework**. [Next.js 16](https://nextjs.org/) (App Router with Turbopack)
- **Runtime**. Node.js 20.9+ (Node 22 recommended via `.nvmrc`), npm only
- **Database & Backend**. [Convex](https://www.convex.dev/)
- **Authentication**. [Clerk](https://clerk.com/)
- **Styling**. [Tailwind CSS](https://tailwindcss.com/) (Brutalist + Dark Mode)
- **Components**. [Radix UI](https://www.radix-ui.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Testing**. [Vitest](https://vitest.dev/) (unit and integration) + [Playwright](https://playwright.dev/) (end-to-end with `@clerk/testing`)
- **Utilities**. [Lucide React](https://lucide.dev/), [JSZip](https://stuk.github.io/jszip/)

## Key Features

- **Guided Three-Stage Workflow**. Specification projects run across three sequential stages, namely Requirements (Brief and PRD), Design (Architecture, Domain Model, and Schemas), and Tasks (Implementation Stories).
- **Flexible Project Modes**. Lite mode generates all stages in a single round with no review stops. Full mode pauses for review between stages. Backend mode focuses directly on system contracts, APIs, and schemas.
- **Persistent Project Rules**. Continuous project-level Constitution decoupled from linear phases. Includes active badges for proposed or unresolved decisions and one-click rule drafting.
- **Universal Multi-Agent Export**. Header export modal accessible from every stage. Generates a canonical `AGENTS.md` grouped by decision status (Rules, Observed, Proposed, Open questions), a minimal `@AGENTS.md` import line in `CLAUDE.md`, and direct compatibility with Cursor and GitHub Copilot without file drift.
- **Credential Readiness Detection**. Upfront validation of LLM credentials before intake to prevent aborted generation attempts.
- **Combined Questions Interface**. Streamlined single-page clarification round for Lite projects with pre-filled AI suggestions.
- **In-Browser Markdown Editor**. Interactive artifact modal with Split, Edit, and Preview modes, character and word counters, token estimates, and reading time.
- **Monaco-Style Schema Validator**. Integrated JSON and YAML validator with line numbering gutter, real-time syntax error diagnostics, formatting, sync to markdown, and automated quick-fix injection for test seams and error envelopes.
- **Vertical Tracer Bullets & Blocking Edges**. Story ticket decomposition with explicit dependency edges, tracer bullet tags, and interactive Kanban boards.
- **Deep Interfaces & Explicit Test Seams**. Technical specs generate formal TypeScript boundary contracts, error envelopes (RFC 7807), and unit/integration test seams.
- **Unambiguous Domain Glossary**. Domain modeling produces strict term glossaries, entity attributes, and relation rules.
- **Optional Grilling Clarification Interview**. Clarification questions capped at 10 items maximum, accompanied by an optional interactive Stress-Test Plan modal to resolve design ambiguities.
- **Evidence-Backed Requirements**. Generated bullet requirements receive stable project IDs, proposed answer or commit-pinned repository references, and an owner review state.
- **Saved Quick Specs History**. Save short-form specs as versioned project artifacts without creating full workflow phases.
- **Chained Worker Architecture**. Long-running LLM generations split into sequential background tasks, bypassing the 600s Convex timeout.
- **Live Generation & Output Preservation**. Incremental persistence of artifact sections with real-time UI updates via Convex reactive queries and partial output retention on cancellation.
- **Multi-LLM Intelligence**. Model registry supporting OpenAI, Anthropic, DeepSeek (including DeepSeek V4 Pro and DeepSeek Flash), Mistral, Z.AI, and Minimax with automatic token budgeting and provider endpoint verification.
- **Admin Console & Settings**. Super-admin management for users, projects, health, security, analytics, moderation, and LLM model catalogs.
- **Encrypted Credentials**. AES-encrypted system and user API keys stored securely in Convex.

## Architecture Overview

### Chained Worker Pattern

SpecForge uses a **Coordinator-Worker** pattern to handle complex generation tasks:

1. **Coordinator Action**. Initializes a `generationTask` in the database with a specific plan of ordered sections.
2. **Scheduled Worker**. An `internalAction` picks up the next section in the plan, executes the LLM call with a fresh 600s budget, and saves the result.
3. **Chain Execution**. After each section, the worker updates task progress and schedules the next worker step until the plan is complete.

### Data Flow

- **Input**. User Project Brief and Answered Phase Questions.
- **Context**. For each section, the worker retrieves previous sections to maintain coherence.
- **Output**. Markdown content persisted to artifact records incrementally.
- **Evidence**. Answer updates and commit-pinned repository files are captured as immutable revisions. Citations outside the project allowlist are discarded, and accepted links remain suggestions until confirmed by an owner.

## Quickstart

### Prerequisites

- Node.js 20.9+ (Node 22 recommended, pinned in `.nvmrc`)
- npm (only supported toolchain)

### Installation

```bash
npm ci
```

### Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required Next.js variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (auto-set by `npx convex dev`)

Optional, required only for GitHub repository connection:

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - server-only GitHub OAuth credentials

Convex functions use a separate deployment environment. Convex does not load these values from `.env.local`. Set the Clerk issuer and encryption key for your development deployment:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN
npx convex env set CONVEX_ENCRYPTION_KEY
```

The CLI prompts for each value. Set the same variables on production with `npx convex env --prod set NAME`. The issuer must match the Clerk JWT template configured for the Convex application. Set `CONVEX_ENCRYPTION_KEY` to a 32-byte hex key.

For GitHub OAuth, register the exact callback URL for each environment, such as `http://localhost:3000/api/github/callback` for local development or `https://your-domain/api/github/callback` in production. Store the OAuth client ID and secret in the server environment. Never prefix the secret with `NEXT_PUBLIC_`.

### Development

Start both servers in separate terminals:

```bash
# Terminal 1: Convex backend
npm run convex

# Terminal 2: Next.js frontend
npm run dev
```

Visit `http://localhost:3000`

### Build & Deploy

```bash
# Production build
npm run build

# Deploy Convex
npx convex deploy
```

## Project Structure

```
specforge/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth-protected routes (Clerk)
│   │   ├── dashboard/           # Project list, creation, and intake
│   │   ├── admin/               # Super-admin dashboard, security, and LLM catalog
│   │   ├── settings/            # User LLM preferences and API keys
│   │   └── {sign-in,sign-up}/
│   ├── api/                     # API endpoints (health check, GitHub OAuth)
│   ├── project/[id]/            # Project overview and workspace pages
│   │   ├── page.tsx             # Three-stage project overview and Project Rules panel
│   │   ├── questions/           # Combined questions page for Lite projects
│   │   ├── quick/               # Saved quick specs history
│   │   └── phase/[phaseId]/     # Stage workspace with Stepper, Tabs, and Next Action
│   └── layout.tsx               # Root layout with providers
├── components/                  # React components
│   ├── ui/                     # Radix UI primitives and Brutalist controls
│   ├── admin/                  # Super-admin navigation and panels
│   ├── dashboard/              # Dashboard project cards and metrics
│   ├── stage-stepper.tsx       # Three-stage progress indicator
│   ├── stage-tabs.tsx          # Sub-phase navigation tabs with section toggles
│   ├── next-action-button.tsx  # Dynamic next-action button
│   ├── stage-card.tsx          # Project overview stage cards
│   ├── project-rules-card.tsx  # Persistent project rules card with decision badge
│   ├── generation-readiness-banner.tsx # Missing credentials warning banner
│   ├── combined-questions.tsx  # Unified clarification question answering
│   ├── export-options.tsx      # Multi-format export dialog
│   ├── artifact-editor-modal.tsx # Markdown editor with split preview and schema tab
│   ├── schema-validator-panel.tsx # Monaco-style JSON/YAML schema validator
│   ├── stress-test-modal.tsx    # Interactive grilling interview modal
│   └── ticket-board.tsx         # Kanban board with tracer bullets and blocking edges
├── convex/                     # Convex backend
│   ├── actions/                # Server actions (LLM generations, worker tasks, ZIP export)
│   ├── lib/                    # Convex backend utilities
│   ├── schema.ts               # Database schema
│   └── *.ts                    # Queries, mutations, and internal workers
├── lib/                        # Shared utilities and core engines
│   ├── workflow.ts             # Central workflow engine, stages, and nextAction
│   ├── export/                 # AGENTS.md rules formatting and export logic
│   ├── llm/                    # LLM providers, model registry, prompt templates, chunking
│   ├── schema/                 # Schema extraction, validation engine, and YAML conversion
│   ├── encryption.ts           # AES-256 credential encryption
│   └── zip.ts                  # ZIP archive generation
├── docs/                       # System architecture, roadmaps, and guides
└── .claude/                    # Claude Code workflow commands
```

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - System architecture, data schema, and streaming patterns
- [Current Roadmap](docs/roadmap.md) - Active phase, rollout state, and historical plan index
- [Guided Three-Stage Workflow Spec](docs/specs/2026-09-25-guided-workflow.md) - Workflow architecture and export unification
- [Implementation Checklist](docs/IMPLEMENTATION_CHECKLIST.md) - Feature milestone tracking
- [Evidence-Backed Specification](docs/specs/2026-09-22-evidence-backed-specs.md) and [Implementation Plan](docs/plans/2026-09-22-evidence-backed-specs.md)
- [Evidence Workflow Baseline](docs/evaluations/2026-09-22-evidence-baseline.md) and [Local Evaluation](docs/evaluations/2026-09-22-evidence-workflow-evaluation.md)
- [Constitution Authoring Guide](docs/Constitution%20Document.md)
- [Architectural Roadmap](docs/ARCHITECTURAL_ROADMAP.md) - Strategic technical evolution
- [AI Question Answering](docs/features/ai-question-answering.md) - Clarification and grilling interview design

## Scripts

| Command                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Start Next.js development server                 |
| `npm run convex`        | Start Convex development server                  |
| `npm run build`         | Production build                                 |
| `npm run lint`          | Run ESLint                                       |
| `npm run typecheck`     | TypeScript type checking                         |
| `npm run test`          | Run unit and integration tests                   |
| `npm run test:coverage` | Run tests with coverage                          |
| `npm run test:e2e`      | Run Playwright smoke and authenticated suites   |

---

Generated by SpecForge Scaffold.
