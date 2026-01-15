# SpecForge: Spec-Driven Project Generator

SpecForge is a high-performance scaffold designed for building **repo-native**, **spec-driven**, and **LLM-agnostic** applications. It provides a solid foundation for generating, previewing, and exporting complex project architectures.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router with Turbopack)
- **Runtime**: [Bun](https://bun.sh/)
- **Database & Backend**: [Convex](https://www.convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Brutalist + Dark Mode)
- **Components**: [Radix UI](https://www.radix-ui.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Utilities**: [Lucide React](https://lucide.dev/), [JSZip](https://stuk.github.io/jszip/)

## Key Features

- **Phase-Based Workflow**: Structured project generation across multiple phases (Brief → PRD → Specs → Stories → Artifacts → Handoff)
- **Chained Worker Architecture**: Long-running LLM generations are broken into sequential background tasks, bypassing the 600s Convex timeout.
- **Incremental Persistence**: Artifacts are forged section-by-section and saved in real-time to prevent data loss.
- **Provider-Model Intelligence**: Automatic matching of LLM providers (DeepSeek, OpenAI, etc.) with their specific enabled models.
- **Multi-LLM Support**: DeepSeek (V3.2), OpenAI (GPT-4o), Anthropic (Claude 3.5), Mistral, Z.AI, and Minimax.
- **Artifact Management**: Real-time preview with high-fidelity markdown rendering.
- **Project Export**: Full project ZIP generation and storage.
- **Encrypted Credentials**: AES-encrypted system and user API keys stored in Convex.

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

- Bun 1.0+ (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 18+

### Installation

```bash
bun install
```

### Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (auto-set by `bunx convex dev`)
- `CONVEX_ENCRYPTION_KEY` - required for encrypting stored credentials

### Development

Start both servers in separate terminals:

```bash
# Terminal 1: Convex backend
bunx convex dev

# Terminal 2: Next.js frontend
bun run dev
```

Visit `http://localhost:3000`

### Build & Deploy

```bash
# Production build
bun run build

# Deploy Convex
bunx convex deploy
```

## Project Structure

```
specforge/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth-protected routes (Clerk)
│   │   ├── dashboard/     # Project list & creation
│   │   ├── admin/         # Admin dashboard & LLM models
│   │   ├── settings/      # User LLM configuration
│   │   └── {sign-in,sign-up}/
│   ├── api/               # API routes (health check)
│   ├── project/[id]/      # Project & phase pages
│   └── layout.tsx         # Root layout with providers
├── components/            # React components
│   ├── ui/               # Radix UI primitives
│   └── *.tsx             # Feature components
├── convex/               # Convex backend
│   ├── actions/          # Server actions (LLM calls)
│   ├── lib/              # Convex utilities
│   ├── schema.ts         # Database schema
│   └── *.ts              # Queries & mutations
├── lib/                  # Shared utilities
│   ├── llm/              # LLM providers, registry, chunking
│   ├── encryption.ts     # Credential encryption
│   └── zip.ts            # ZIP generation
├── docs/                 # Documentation
└── .claude/              # Claude Code configuration
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data models
- [Implementation Checklist](docs/IMPLEMENTATION_CHECKLIST.md) - Feature status
- [Code Review Handoff](docs/CODE_REVIEW_HANDOFF.md) - Review checklist
- [AI Question Answering](docs/features/ai-question-answering.md) - Feature spec

## Scripts

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `bun run dev`         | Start Next.js development server |
| `bunx convex dev`     | Start Convex development server  |
| `bun run build`       | Production build                 |
| `bun run lint`        | Run ESLint                       |
| `bun run typecheck`   | TypeScript type checking         |
| `bun test`            | Run unit tests                   |
| `bun test --coverage` | Run tests with coverage          |

---

Generated by SpecForge Scaffold.
