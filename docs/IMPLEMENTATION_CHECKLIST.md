# SpecForge Implementation Checklist

**Last Updated:** January 26, 2026  
**Status:** Core MVP complete (streaming + cancel implemented)

---

## Completed Items

- [x] Next.js 16.1.1 + React 19.2.0 + Convex 1.22.0 + Clerk 6.36.7 setup
- [x] Convex schema: projects, phases, artifacts, llmModels, userLlmConfigs (+ streaming fields/indexes on artifacts)
- [x] Clerk middleware (middleware.ts) for auth protection
- [x] Dashboard auth fix (async auth() for Clerk v6)
- [x] Convex dev server running at localhost:3000
- [x] Basic CRUD: createProject, getProject, getPhase queries
- [x] lib/llm/registry.ts with FALLBACK_MODELS
- [x] lib/llm/chunking.ts with section planning
- [x] lib/zip.ts with basic ZIP creation using jszip
- [x] Basic project/[id] page stubs
- [x] Basic dashboard/admin/settings pages stubs
- [x] **Week 1 Complete:** Project intake form, questions generation, questions UI, interactive phase page, answer mutations
- [x] Real-time UX (pseudo-streaming): incremental persistence + reactive live preview during generation
- [x] Cancel generation: stops worker and preserves partial output (`streamStatus='cancelled'`)

---

## 📋 Remaining Work

### Week 1: Project Intake & Questions ✅ COMPLETE

- [x] Create project intake form: `app/(auth)/dashboard/new/page.tsx`
- [x] Implement questions generation in Convex (generateQuestions action)
- [x] Build questions UI component
- [x] Update phase page with interactive questions
- [x] Add answer mutation for saving responses

### Week 2: Models, Chunking, Artifacts ✅ COMPLETE

- [x] Implement LLM provider clients (OpenAI, Anthropic)
- [x] Enhance chunking.ts with actual chunking logic
- [x] Complete registry.ts with model lookup and provider resolution
- [x] Implement full artifact creation with self-critique
- [x] Add artifact CRUD mutations
- [x] Create artifact viewer component

### Week 3: Config, ZIP, Admin, Handoff ✅ COMPLETE

- [x] Implement user LLM config save with encryption
- [x] Build full settings page with provider/model selection
- [x] Implement credential resolution in generatePhase
- [x] Enhance ZIP generation with folder structure
- [x] Complete admin dashboard
- [x] Build admin LLM models management page
- [x] Add admin mutations for model management
- [x] Implement handoff artifact generation
- [x] Add project ZIP download functionality

### Supporting Infrastructure ✅ COMPLETE

- [x] Create lib/encryption.ts for API key encryption
- [x] Add lib/utils.ts for cn() helper
- [x] Implement proper error handling
- [x] Add loading states and progress indicators
- [x] Build phase status indicators

### Phase Modernization & Artifact Tooling ✅ COMPLETE

- [x] Vertical tracer bullets with blocking edges in tickets (`convex/schema.ts`, `lib/ticket-parser.ts`, `components/ticket-board.tsx`)
- [x] Deep interfaces and explicit test seams in technical specs (`convex/actions/generatePhase.ts`, `lib/llm/section-plans.ts`)
- [x] Unambiguous domain model glossary generation (`lib/llm/prompts/domain-model.ts`)
- [x] Grilling clarification interview capped at 10 questions tops (`convex/actions/generateQuestions.ts`, `components/questions-panel.tsx`)
- [x] Optional Stress-Test Plan modal for interactive deep-dive grilling (`components/stress-test-modal.tsx`)
- [x] In-browser markdown artifact editor modal with Split, Edit, Preview, and Schema modes (`components/artifact-editor-modal.tsx`)
- [x] Live character, word, and token counters with estimated reading time
- [x] Monaco-style JSON and YAML schema validator with line numbering gutter and diagnostic bar (`components/schema-validator-panel.tsx`)
- [x] Real-time embedded code block extraction and two-way sync to markdown (`lib/schema/phase-schema-extractor.ts`)
- [x] Automated quick-fix insertions for test seams, RFC 7807 error envelopes, glossaries, and tracer bullets
- [x] Super-admin console suite: security, health, analytics, moderation, users, and LLM model directory (`app/(auth)/admin/*`)

---

## Project Structure Reference

```
app/
├── layout.tsx                    # Clerk + Convex providers
├── page.tsx                      # Landing page
├── (auth)/                       # Auth-protected routes
│   ├── dashboard/
│   │   ├── page.tsx              # Project list
│   │   └── new/                  # New project form ✅
│   ├── admin/
│   │   ├── dashboard/            # Admin dashboard ✅
│   │   └── llm-models/           # LLM models management ✅
│   ├── settings/
│   │   └── llm-config/           # LLM config page ✅
│   ├── sign-in/
│   └── sign-up/
└── project/
    └── [id]/
        ├── page.tsx              # Project overview
        └── phase/
            └── [phaseId]/        # Phase detail ✅

convex/
├── schema.ts                     # Database schema
├── projects.ts                   # Project CRUD queries/mutations
├── artifacts.ts                  # Artifact CRUD mutations ✅
├── actions/
│   ├── generatePhase.ts          # Phase generation with self-critique ✅
│   ├── generateQuestions.ts      # Questions generation ✅
│   └── generateProjectZip.ts     # ZIP generation ✅
├── internal.ts                   # Internal mutations
├── admin.ts                      # Admin mutations ✅
├── userConfigs.ts                # User LLM configs ✅
└── llmModels.ts                  # Model queries

lib/
├── auth.tsx                      # Convex auth provider
├── llm/
│   ├── registry.ts               # Model registry ✅
│   ├── chunking.ts               # Chunking logic ✅
│   └── providers/
│       ├── openai.ts             # OpenAI provider ✅
│       └── anthropic.ts          # Anthropic provider ✅
├── zip.ts                        # ZIP creation ✅
├── encryption.ts                 # API key encryption ✅
└── utils.ts                      # Utility functions ✅
```

---

## Dependencies

```bash
# Current installed packages
next@16.1.1
react@19.2.0
react-dom@19.2.0
convex@1.22.0
@clerk/nextjs@6.36.7
@clerk/clerk-react@5.59.3
@tanstack/react-query@5.71.10
jszip@3.10.1
adm-zip@0.5.14
```

---

## Quick Start Commands

```bash
# Terminal 1: Convex backend
npm run convex

# Terminal 2: Next.js frontend
npm run dev

# Typecheck / lint / tests
npm run typecheck
npm run lint
npm run test -- --run --testTimeout=20000
```
