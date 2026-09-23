# SpecForge: Spec-Driven Project Generator

SpecForge is a high-performance scaffold designed for building **repo-native**, **spec-driven**, and **LLM-agnostic** applications. It provides a solid foundation for generating, previewing, and exporting complex project architectures.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router with Turbopack)
- **Runtime**: Node.js 20.9+ (Node 22 recommended via `.nvmrc`), npm only
- **Database & Backend**: [Convex](https://www.convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Brutalist + Dark Mode)
- **Components**: [Radix UI](https://www.radix-ui.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Testing**: [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) (smoke)
- **Utilities**: [Lucide React](https://lucide.dev/), [JSZip](https://stuk.github.io/jszip/)

## Key Features

- **Phase-Based Specification Engine**: Structured project generation across iterative phases (Brief, PRD, Architecture & Specs, User Stories, Artifacts, Handoff).
- **In-Browser Markdown Editor**: Interactive artifact modal with Split, Edit, and Preview modes, character and word counters, token estimates, and reading time.
- **Monaco-Style Schema Validator**: Integrated JSON and YAML validator with line numbering gutter, real-time syntax error diagnostics, formatting, sync to markdown, and automated quick-fix injection for test seams and error envelopes.
- **Vertical Tracer Bullets & Blocking Edges**: Story ticket decomposition with explicit dependency edges, tracer bullet tags, and interactive Kanban boards.
- **Deep Interfaces & Explicit Test Seams**: Technical specs generate formal TypeScript boundary contracts, error envelopes (RFC 7807), and unit/integration test seams.
- **Unambiguous Domain Glossary**: Domain modeling phase produces strict term glossaries, entity attributes, and relation rules.
- **Optional Grilling Clarification Interview**: Clarification questions capped at 10 items maximum, accompanied by an optional interactive Stress-Test Plan modal to resolve design ambiguities.
- **Chained Worker Architecture**: Long-running LLM generations split into sequential background tasks, bypassing the 600s Convex timeout.
- **Live Generation (Pseudo-Streaming)**: Incremental persistence of artifact sections with real-time UI updates via Convex reactive queries.
- **Cancel with Output Preservation**: Users can halt generation at any time while retaining partial markdown outputs.
- **Multi-LLM Intelligence**: Model registry supporting OpenAI, Anthropic, DeepSeek, Mistral, Z.AI, and Minimax with automatic token budgeting.
- **Admin Console & Settings**: Super-admin management for users, projects, health, security, analytics, moderation, and LLM model catalogs.
- **Project Export**: Download individual artifacts or complete full-project ZIP archives.
- **Encrypted Credentials**: AES-encrypted system and user API keys stored securely in Convex.

## Architecture Overview

### Chained Worker Pattern

SpecForge uses a **Coordinator-Worker** pattern to handle complex generation tasks:

1. **Coordinator Action**: Initializes a `generationTask` in the database with a specific plan (ordered sections).
2. **Scheduled Worker**: An `internalAction` picks up the next section in the plan, executes the LLM call with a fresh 600s budget, and saves the result.
3. **Chain Execution**: After each section, the worker updates the task progress and schedules the next worker step until the plan is complete.

### Data Flow

- **Input**: User Project Brief + Answered Phase Questions.
- **Context**: For each section, the worker retrieves previous sections to maintain coherence.
- **Output**: Markdown content appended to the phase's `artifact` record incrementally.

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

Required variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (auto-set by `npx convex dev`)
- `CONVEX_ENCRYPTION_KEY` - required for encrypting stored credentials

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
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth-protected routes (Clerk)
│   │   ├── dashboard/     # Project list, creation, and intake
│   │   ├── admin/         # Super-admin dashboard, security, and LLM catalog
│   │   ├── settings/      # User LLM preferences and API keys
│   │   └── {sign-in,sign-up}/
│   ├── api/               # API endpoints (health check)
│   ├── project/[id]/      # Project overview and phase pages
│   └── layout.tsx         # Root layout with providers
├── components/            # React components
│   ├── ui/               # Radix UI primitives and Brutalist controls
│   ├── admin/            # Super-admin navigation and panels
│   ├── artifact-editor-modal.tsx # Markdown editor with split preview and schema tab
│   ├── schema-validator-panel.tsx # Monaco-style JSON/YAML schema validator
│   ├── stress-test-modal.tsx      # Interactive grilling interview modal
│   ├── ticket-board.tsx   # Kanban board with tracer bullets and blocking edges
│   └── *.tsx             # Feature components
├── convex/               # Convex backend
│   ├── actions/          # Server actions (LLM generations, worker tasks, ZIP export)
│   ├── lib/              # Convex backend utilities
│   ├── schema.ts         # Database schema
│   └── *.ts              # Queries, mutations, and internal workers
├── lib/                  # Shared utilities and core engines
│   ├── llm/              # LLM providers, model registry, prompt templates, chunking
│   ├── schema/           # Schema extraction, validation engine, and YAML conversion
│   ├── encryption.ts     # AES-256 credential encryption
│   └── zip.ts            # ZIP archive generation
├── docs/                 # System architecture, roadmaps, and guides
└── .claude/              # Claude Code workflow commands
```

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - System architecture, data schema, and streaming patterns
- [Implementation Checklist](docs/IMPLEMENTATION_CHECKLIST.md) - Feature milestone tracking
- [Architectural Roadmap](docs/ARCHITECTURAL_ROADMAP.md) - Strategic technical evolution
- [AI Question Answering](docs/features/ai-question-answering.md) - Clarification and grilling interview design

## Scripts

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Start Next.js development server |
| `npm run convex`        | Start Convex development server  |
| `npm run build`         | Production build                 |
| `npm run lint`          | Run ESLint                       |
| `npm run typecheck`     | TypeScript type checking         |
| `npm run test`          | Run unit tests                   |
| `npm run test:coverage` | Run tests with coverage          |
| `npm run test:e2e`      | Run Playwright smoke test        |

---

Generated by SpecForge Scaffold.
