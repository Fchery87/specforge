# SpecForge v2.0 — System Architecture Document

**Version:** 1.0  
**Date:** January 15, 2026  
**Author:** SpecForge Architecture Team  
**Status:** Production-Ready Design  
**Based On:** SpecForge v2.0 PRD (2026-01-15)

> **Implementation note (Jan 2026):** The current repository implements streaming as **incremental persistence** (chunked continuation calls + periodic DB flushes) surfaced via Convex reactive queries. True provider-native streaming adapters are not required for the current “live preview” UX.

---

## 1. Executive Overview

### 1.1 Purpose

This document defines the production-ready system architecture for SpecForge v2.0, translating PRD requirements into concrete technical designs, data flows, and implementation patterns.

### 1.2 Scope

| In Scope                         | Out of Scope              |
| -------------------------------- | ------------------------- |
| Real-time streaming architecture | Mobile native apps        |
| Template management system       | Self-hosted deployment    |
| Multi-format export engine       | White-label customization |
| Spec versioning & diffing        | Enterprise SSO (Phase 2)  |
| Test case generation pipeline    | Offline mode              |
| Observability & telemetry        | Multi-region deployment   |

### 1.3 Architecture Principles

1. **Real-Time First** — Leverage Convex's reactive queries for instantaneous UI updates
2. **Worker Isolation** — Long-running LLM tasks execute in isolated workers with timeout recovery
3. **Schema Evolution** — All database changes maintain backward compatibility
4. **Provider Agnostic** — LLM integrations abstracted behind unified client interface
5. **Zero Truncation** — Chunked generation ensures complete output regardless of model limits

---

## 2. System Context

### 2.1 C4 Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SYSTEMS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   OpenAI     │  │  Anthropic   │  │   DeepSeek   │  │   Mistral    │    │
│  │   GPT-4o     │  │   Claude     │  │     V3.2     │  │    Large     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
│  ┌──────┴───────┐  ┌──────┴───────┐                                        │
│  │    Z.AI      │  │   Minimax    │                                        │
│  │   GLM-4.7    │  │     M2.1     │                                        │
│  └──────┬───────┘  └──────┬───────┘                                        │
│         │                 │                                                │
│         └────────┬────────┴────────────────────────────────────────────────┤
│                  │                                                         │
│                  ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         SPECFORGE v2.0                               │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │                    Next.js 16 Frontend                       │    │  │
│  │  │         (React 19, App Router, Tailwind, Framer)            │    │  │
│  │  └───────────────────────────┬─────────────────────────────────┘    │  │
│  │                              │ WebSocket / HTTP                     │  │
│  │  ┌───────────────────────────▼─────────────────────────────────┐    │  │
│  │  │                      Convex Backend                          │    │  │
│  │  │    (Queries, Mutations, Actions, Scheduled Workers)          │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                  │                                                         │
│                  ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                          AUTHENTICATION                              │  │
│  │                      Clerk (OAuth, JWT, RBAC)                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 User Actors

| Actor         | Description                   | Access Level                       |
| ------------- | ----------------------------- | ---------------------------------- |
| **Anonymous** | Landing page visitor          | Public routes only                 |
| **User**      | Authenticated project creator | Own projects, templates            |
| **Admin**     | Platform administrator        | All data, system config, telemetry |

---

## 3. Component Architecture

### 3.1 Frontend Architecture (Next.js 16)

```
app/
├── (public)/                    # Unauthenticated routes
│   ├── page.tsx                 # Landing page
│   ├── privacy/                 # Privacy policy
│   └── terms/                   # Terms of service
│
├── (auth)/                      # Clerk-protected routes
│   ├── dashboard/
│   │   ├── page.tsx             # Project list
│   │   └── new/
│   │       └── page.tsx         # NEW: Template gallery + project creation
│   ├── admin/
│   │   ├── dashboard/           # System overview
│   │   ├── llm-models/          # Model configuration
│   │   └── analytics/           # NEW: Observability dashboard
│   └── settings/
│       ├── llm-config/          # User LLM preferences
│       └── export-preferences/  # NEW: Default export formats
│
└── project/
    └── [id]/
        ├── page.tsx             # Project overview
        └── phase/
            └── [phaseId]/
                ├── page.tsx     # Phase detail with streaming
                └── versions/    # NEW: Version history view
                    └── page.tsx
```

### 3.2 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         App Shell                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      SiteHeader                                │  │
│  │  [Logo] [Dashboard] [Admin?] [Settings] [UserButton]          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Page Content                              │  │
│  │                                                                │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────────┐ │  │
│  │  │                 │  │                                     │ │  │
│  │  │   PhaseStepper  │  │        MainContent                  │ │  │
│  │  │   (Sidebar)     │  │                                     │ │  │
│  │  │                 │  │  ┌────────────────────────────────┐ │ │  │
│  │  │  ○ Brief        │  │  │      StreamingArtifact         │ │ │  │
│  │  │  ● PRD          │  │  │  ┌──────────────────────────┐  │ │ │  │
│  │  │  ○ Specs        │  │  │  │   SectionProgress        │  │ │ │  │
│  │  │  ○ Stories      │  │  │  │   ████████░░░░░░ 60%     │  │ │ │  │
│  │  │  ○ Tests (new)  │  │  │  └──────────────────────────┘  │ │ │  │
│  │  │  ○ Artifacts    │  │  │  ┌──────────────────────────┐  │ │ │  │
│  │  │  ○ Handoff      │  │  │  │   MarkdownPreview        │  │ │ │  │
│  │  │                 │  │  │  │   (live updating)        │  │ │ │  │
│  │  └─────────────────┘  │  │  └──────────────────────────┘  │ │ │  │
│  │                       │  │  ┌──────────────────────────┐  │ │ │  │
│  │                       │  │  │   ActionBar              │  │ │ │  │
│  │                       │  │  │   [Cancel] [Regenerate]  │  │ │ │  │
│  │                       │  │  └──────────────────────────┘  │ │ │  │
│  │                       │  └────────────────────────────────┘ │ │  │
│  │                       └─────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      SiteFooter                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Backend Architecture (Convex)

```
convex/
├── _generated/                  # Auto-generated types
├── schema.ts                    # Database schema (v2 additions below)
│
├── queries/                     # Read operations
│   ├── projects.ts              # getProject, getProjects, getProjectPhases
│   ├── artifacts.ts             # getArtifact, getArtifactVersions (NEW)
│   ├── templates.ts             # getTemplates, getTemplateBySlug (NEW)
│   └── telemetry.ts             # getProviderStats, getErrorLogs (NEW)
│
├── mutations/                   # Write operations
│   ├── projects.ts              # createProject, updateProject
│   ├── artifacts.ts             # createVersion, restoreVersion (NEW)
│   ├── phases.ts                # updatePhaseStatus, saveAnswer
│   └── userPrefs.ts             # saveExportPreferences (NEW)
│
├── actions/                     # Long-running operations
│   ├── generatePhase.ts         # Coordinator action
│   ├── generateQuestions.ts     # Question generation
│   ├── generateProjectZip.ts    # ZIP export
│   └── generateExports.ts       # NEW: Multi-format export generation
│
├── internalActions.ts           # Background workers
│   ├── generatePhaseWorker      # Per-section generation with streaming
│   ├── generateQuestionsWorker  # Per-question AI answers
│   └── generateTestsWorker      # NEW: Test case generation
│
├── internal.ts                  # Internal mutations
│   ├── appendPartialContent     # NEW: Streaming content updates
│   ├── createArtifactVersion    # NEW: Version snapshot
│   └── logTelemetryEvent        # NEW: Analytics logging
│
└── lib/
    └── auth.ts                  # isAdmin, requireAuth helpers
```

---

## 4. Data Architecture

### 4.1 Complete Schema (v2.0)

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============================================================================
  // EXISTING TABLES (v1.x)
  // ============================================================================

  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('complete')
    ),
    templateId: v.optional(v.id('templates')), // NEW: Source template
    createdAt: v.number(),
    updatedAt: v.number(),
    zipStorageId: v.optional(v.id('_storage')),
  })
    .index('by_user', ['userId'])
    .index('by_template', ['templateId']), // NEW

  phases: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(), // 'brief' | 'prd' | 'specs' | 'stories' | 'tests' | 'artifacts' | 'handoff'
    status: v.union(
      v.literal('pending'),
      v.literal('generating'),
      v.literal('ready'),
      v.literal('error')
    ),
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        answer: v.optional(v.string()),
        aiGenerated: v.boolean(),
        required: v.optional(v.boolean()),
      })
    ),
  }).index('by_project', ['projectId']),

  artifacts: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    previewHtml: v.string(),
    sections: v.array(
      v.object({
        name: v.string(),
        tokens: v.number(),
        model: v.string(),
      })
    ),
    // NEW v2.0 fields
    streamStatus: v.optional(
      v.union(
        v.literal('idle'),
        v.literal('streaming'),
        v.literal('paused'),
        v.literal('complete'),
        v.literal('cancelled')
      )
    ),
    currentSection: v.optional(v.string()),
    sectionsCompleted: v.optional(v.number()),
    sectionsTotal: v.optional(v.number()),
    tokensGenerated: v.optional(v.number()),
    currentVersionNumber: v.optional(v.number()),
  })
    .index('by_project', ['projectId'])
    .index('by_phase', ['projectId', 'phaseId']), // NEW

  llmModels: defineTable({
    provider: v.string(),
    modelId: v.string(),
    contextTokens: v.number(),
    maxOutputTokens: v.number(),
    defaultMax: v.number(),
    enabled: v.boolean(),
  }).index('by_model', ['modelId']),

  systemCredentials: defineTable({
    provider: v.string(),
    apiKey: v.optional(v.bytes()),
    isEnabled: v.boolean(),
    zaiEndpointType: v.optional(
      v.union(v.literal('paid'), v.literal('coding'))
    ),
    zaiIsChina: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_provider', ['provider']),

  userLlmConfigs: defineTable({
    userId: v.string(),
    provider: v.string(),
    apiKey: v.optional(v.bytes()),
    defaultModel: v.string(),
    useSystem: v.boolean(),
    systemKeyId: v.optional(v.string()),
    zaiEndpointType: v.optional(
      v.union(v.literal('paid'), v.literal('coding'))
    ),
    zaiIsChina: v.optional(v.boolean()),
  }).index('by_user', ['userId']),

  generationTasks: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.union(
      v.literal('artifact'),
      v.literal('questions'),
      v.literal('tests')
    ), // MODIFIED
    status: v.union(
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed')
    ),
    currentStep: v.number(),
    totalSteps: v.number(),
    plan: v.any(),
    metadata: v.any(),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_project_phase', ['projectId', 'phaseId']),

  // ============================================================================
  // NEW TABLES (v2.0)
  // ============================================================================

  templates: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    category: v.union(
      v.literal('web-app'),
      v.literal('mobile'),
      v.literal('backend'),
      v.literal('developer-tool'),
      v.literal('marketing'),
      v.literal('other')
    ),
    icon: v.string(), // Lucide icon name
    prefilledBrief: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
    }),
    defaultAnswers: v.array(
      v.object({
        phaseId: v.string(),
        questionId: v.string(),
        answer: v.string(),
      })
    ),
    suggestedStack: v.array(v.string()),
    estimatedTimeSaved: v.number(),
    usageCount: v.number(),
    isSystem: v.boolean(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_category', ['category'])
    .index('by_slug', ['slug'])
    .index('by_usage', ['usageCount']),

  artifactVersions: defineTable({
    artifactId: v.id('artifacts'),
    version: v.number(),
    content: v.string(),
    previewHtml: v.string(),
    changeType: v.union(
      v.literal('generated'),
      v.literal('regenerated'),
      v.literal('edited'),
      v.literal('restored'),
      v.literal('section_regen')
    ),
    changeSummary: v.optional(v.string()),
    changedBy: v.string(),
    createdAt: v.number(),
    sections: v.array(
      v.object({
        name: v.string(),
        tokens: v.number(),
        model: v.string(),
      })
    ),
  })
    .index('by_artifact', ['artifactId'])
    .index('by_artifact_version', ['artifactId', 'version']),

  userExportPreferences: defineTable({
    userId: v.string(),
    defaultFormats: v.array(v.string()),
    lastExportDate: v.optional(v.number()),
  }).index('by_user', ['userId']),

  testConfigs: defineTable({
    projectId: v.id('projects'),
    frameworks: v.array(v.string()),
    coverageGoal: v.number(),
    includeE2E: v.boolean(),
    skipPhase: v.boolean(),
  }).index('by_project', ['projectId']),

  telemetryEvents: defineTable({
    eventType: v.union(
      v.literal('generation_start'),
      v.literal('generation_complete'),
      v.literal('generation_error'),
      v.literal('export_created'),
      v.literal('project_created'),
      v.literal('phase_completed'),
      v.literal('template_used'),
      v.literal('version_restored')
    ),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    phaseId: v.optional(v.string()),
    provider: v.optional(v.string()),
    modelId: v.optional(v.string()),
    duration: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCategory: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index('by_type', ['eventType'])
    .index('by_timestamp', ['timestamp'])
    .index('by_user', ['userId'])
    .index('by_provider', ['provider'])
    .index('by_project', ['projectId']),
});
```

### 4.2 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
│   User      │       │  Template   │       │  ExportPrefs    │
│  (Clerk)    │       │             │       │                 │
└──────┬──────┘       └──────┬──────┘       └────────┬────────┘
       │                     │                       │
       │ owns                │ uses                  │ has
       ▼                     ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                         Project                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ id, userId, title, description, templateId?, status   │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────┬──────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┬───────────────┐
        │               │               │               │
        ▼               ▼               ▼               ▼
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────────┐
│   Phase   │   │ Artifact  │   │ TestConfig│   │ Telemetry     │
│           │   │           │   │           │   │               │
│ questions │   │ versions──┼──▶│ frameworks│   │ events        │
│ status    │   │ streaming │   │ coverage  │   │ metrics       │
└───────────┘   └─────┬─────┘   └───────────┘   └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ ArtifactVer   │
              │               │
              │ version#      │
              │ content       │
              │ changeType    │
              └───────────────┘
```

---

## 5. Key Workflows

### 5.1 Real-Time Streaming Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STREAMING GENERATION SEQUENCE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Frontend                  Convex Backend               LLM Provider        │
│     │                           │                            │              │
│     │──── generatePhase() ─────▶│                            │              │
│     │                           │                            │              │
│     │                           │──── Create Task ──────────▶│              │
│     │                           │     (generationTasks)      │              │
│     │                           │                            │              │
│     │                           │──── Set streamStatus ──────│              │
│     │                           │     = 'streaming'          │              │
│     │                           │                            │              │
│     │◀── useQuery(artifact) ────│                            │              │
│     │    (reactive subscription)│                            │              │
│     │                           │                            │              │
│     │                           │    ┌─────────────────────┐ │              │
│     │                           │    │ generatePhaseWorker │ │              │
│     │                           │    │                     │ │              │
│     │                           │    │ For each section:   │ │              │
│     │                           │    │                     │ │              │
│     │                           │    │  ┌─────────────┐    │ │              │
│     │                           │    │  │ Call LLM    │◀───┼─┼──────────────│
│     │                           │    │  │ Stream resp │────┼─┼─────────────▶│
│     │                           │    │  └─────────────┘    │ │              │
│     │                           │    │                     │ │              │
│     │                           │    │  Every 50 tokens:   │ │              │
│     │                           │    │  ┌─────────────────┐│ │              │
│     │◀─────── Real-time ────────┼────┼──│appendPartial    ││ │              │
│     │         UI update         │    │  │Content()        ││ │              │
│     │                           │    │  └─────────────────┘│ │              │
│     │                           │    │                     │ │              │
│     │                           │    │  Section complete:  │ │              │
│     │                           │    │  - Update progress  │ │              │
│     │                           │    │  - Create version   │ │              │
│     │                           │    │  - Schedule next    │ │              │
│     │                           │    └─────────────────────┘ │              │
│     │                           │                            │              │
│     │                           │──── Set streamStatus ──────│              │
│     │                           │     = 'complete'           │              │
│     │                           │                            │              │
│     │◀── Final UI state ────────│                            │              │
│     │                           │                            │              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Template-Based Project Creation

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    TEMPLATE PROJECT CREATION                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User                    Frontend                   Convex              │
│    │                         │                          │                │
│    │── Navigate to /new ────▶│                          │                │
│    │                         │                          │                │
│    │                         │── getTemplates() ───────▶│                │
│    │                         │◀─ Template list ─────────│                │
│    │                         │                          │                │
│    │◀─ Display gallery ──────│                          │                │
│    │                         │                          │                │
│    │── Select "SaaS MVP" ───▶│                          │                │
│    │                         │                          │                │
│    │                         │── getTemplateBySlug() ──▶│                │
│    │                         │◀─ Full template data ────│                │
│    │                         │                          │                │
│    │◀─ Pre-fill form ────────│                          │                │
│    │   (title, description,  │                          │                │
│    │    suggested stack)     │                          │                │
│    │                         │                          │                │
│    │── Customize & Submit ──▶│                          │                │
│    │                         │                          │                │
│    │                         │── createProject() ──────▶│                │
│    │                         │   {templateId: ...}      │                │
│    │                         │                          │                │
│    │                         │   1. Create project      │                │
│    │                         │   2. Copy default answers│                │
│    │                         │   3. Increment usageCount│                │
│    │                         │   4. Log telemetry       │                │
│    │                         │                          │                │
│    │                         │◀─ projectId ─────────────│                │
│    │                         │                          │                │
│    │◀─ Redirect to project ──│                          │                │
│    │                         │                          │                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Version Restore Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VERSION RESTORE FLOW                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "History" on artifact                                    │
│     │                                                                    │
│     ▼                                                                    │
│  2. getArtifactVersions(artifactId) → List of versions                  │
│     │                                                                    │
│     ▼                                                                    │
│  3. User selects v3 and v5 to compare                                   │
│     │                                                                    │
│     ▼                                                                    │
│  4. computeDiff(v3.content, v5.content) → Diff result                   │
│     │  (Client-side diffing using diff-match-patch)                     │
│     ▼                                                                    │
│  5. Display side-by-side with highlighting                              │
│     │                                                                    │
│     ▼                                                                    │
│  6. User clicks "Restore v3"                                            │
│     │                                                                    │
│     ▼                                                                    │
│  7. restoreVersion(artifactId, version: 3)                              │
│     │                                                                    │
│     ├── Create new version (v6) with:                                   │
│     │   - content: v3.content                                           │
│     │   - changeType: 'restored'                                        │
│     │   - changeSummary: 'Restored from v3'                             │
│     │                                                                    │
│     ├── Update artifact.currentVersionNumber = 6                        │
│     │                                                                    │
│     └── Log telemetry: version_restored                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. LLM Integration Architecture

### 6.1 Provider Abstraction Layer

```typescript
// lib/llm/types.ts

export interface LlmModel {
  id: string;
  provider: string;
  contextTokens: number;
  maxOutputTokens: number;
  defaultMax: number;
  enabled: boolean;
}

export interface LlmClient {
  complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<CompletionResponse>;
  stream?(prompt: string, options: CompletionOptions): AsyncIterable<string>; // NEW
}

export interface CompletionOptions {
  model: string;
  maxTokens: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface CompletionResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter';
}
```

### 6.2 Provider Registry

```typescript
// lib/llm/registry.ts

export const MODEL_REGISTRY: RegistryEntry[] = [
  // OpenAI
  { model: { id: 'gpt-4o', provider: 'openai', ... }, displayName: 'GPT-4o' },
  { model: { id: 'gpt-4o-mini', provider: 'openai', ... }, displayName: 'GPT-4o Mini' },

  // Anthropic
  { model: { id: 'claude-sonnet-4-5', provider: 'anthropic', ... }, displayName: 'Claude Sonnet 4.5' },
  { model: { id: 'claude-haiku-4-5', provider: 'anthropic', ... }, displayName: 'Claude Haiku 4.5' },

  // DeepSeek
  { model: { id: 'deepseek-chat', provider: 'deepseek', ... }, displayName: 'DeepSeek V3.2' },

  // Mistral
  { model: { id: 'mistral-large', provider: 'mistral', ... }, displayName: 'Mistral Large' },

  // Z.AI (GLM)
  { model: { id: 'glm-4.7', provider: 'zai', ... }, displayName: 'GLM-4.7' },

  // Minimax
  { model: { id: 'minimax-m2.1', provider: 'minimax', ... }, displayName: 'MiniMax M2.1' },
];
```

### 6.3 Streaming Implementation

```typescript
// lib/llm/streaming.ts

export async function* streamCompletion(
  client: LlmClient,
  prompt: string,
  options: CompletionOptions
): AsyncIterable<StreamChunk> {
  if (client.stream) {
    // Native streaming support
    let accumulated = '';
    for await (const chunk of client.stream(prompt, options)) {
      accumulated += chunk;
      yield { content: chunk, accumulated, done: false };
    }
    yield { content: '', accumulated, done: true };
  } else {
    // Fallback: simulate streaming with single response
    const response = await client.complete(prompt, options);
    yield {
      content: response.content,
      accumulated: response.content,
      done: true,
    };
  }
}

interface StreamChunk {
  content: string;
  accumulated: string;
  done: boolean;
}
```

---

## 7. Export Engine Architecture

### 7.1 Export Format Registry

```typescript
// lib/export/registry.ts

export interface ExportFormat {
  id: string;
  name: string;
  filename: string;
  description: string;
  icon: string; // Lucide icon name
  generate: (context: ExportContext) => string;
  maxTokens?: number;
  validateOutput?: (content: string) => boolean;
}

export interface ExportContext {
  project: Project;
  artifacts: Map<string, Artifact>; // phaseId -> artifact
  template?: Template;
  metadata: {
    generatedAt: Date;
    specForgeVersion: string;
  };
}

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'cursor',
    name: 'Cursor Rules',
    filename: '.cursorrules',
    description: 'AI context file for Cursor IDE',
    icon: 'MousePointer2',
    generate: generateCursorRules,
    maxTokens: 100000,
  },
  {
    id: 'agents-md',
    name: 'AGENTS.md',
    filename: 'AGENTS.md',
    description: 'Agent instructions for Claude Code, Codex, etc.',
    icon: 'Bot',
    generate: generateAgentsMd,
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    filename: '.github/copilot-instructions.md',
    description: 'Custom instructions for GitHub Copilot',
    icon: 'Github',
    generate: generateCopilotInstructions,
  },
  {
    id: 'kiro',
    name: 'AWS Kiro',
    filename: 'kiro.steering',
    description: 'AWS Kiro steering configuration',
    icon: 'Cloud',
    generate: generateKiroSteering,
  },
];
```

**Product note:** Per-artifact ZIP downloads are not supported in v2.0; hide those UI actions until a real export endpoint exists.

### 7.2 Export Generation Action

```typescript
// convex/actions/generateExports.ts

export const generateExports = action({
  args: {
    projectId: v.id('projects'),
    formatIds: v.array(v.string()), // ['cursor', 'agents-md', ...]
  },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });

    const artifacts = await ctx.runQuery(api.artifacts.getProjectArtifacts, {
      projectId: args.projectId,
    });

    const exportContext: ExportContext = {
      project,
      artifacts: new Map(artifacts.map((a) => [a.phaseId, a])),
      metadata: {
        generatedAt: new Date(),
        specForgeVersion: '2.0.0',
      },
    };

    const exports: Record<string, string> = {};

    for (const formatId of args.formatIds) {
      const format = EXPORT_FORMATS.find((f) => f.id === formatId);
      if (format) {
        exports[format.filename] = format.generate(exportContext);
      }
    }

    // Log telemetry
    await ctx.runMutation(internal.internal.logTelemetryEvent, {
      eventType: 'export_created',
      projectId: args.projectId,
      metadata: { formats: args.formatIds },
    });

    return exports;
  },
});
```

**Operational note:** When a project is deleted, cascade removal of ZIP storage and any related `generationTasks` to avoid orphaned storage and stale work items.

---

## 8. Observability Architecture

### 8.1 Telemetry Collection

```typescript
// convex/internal.ts

export const logTelemetryEvent = internalMutation({
  args: {
    eventType: v.string(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    phaseId: v.optional(v.string()),
    provider: v.optional(v.string()),
    modelId: v.optional(v.string()),
    duration: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorCategory: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('telemetryEvents', {
      ...args,
      eventType: args.eventType as any,
      timestamp: Date.now(),
    });
  },
});
```

### 8.2 Analytics Queries

```typescript
// convex/queries/telemetry.ts

export const getProviderStats = query({
  args: {
    timeRange: v.union(v.literal('24h'), v.literal('7d'), v.literal('30d')),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - TIME_RANGES[args.timeRange];

    const events = await ctx.db
      .query('telemetryEvents')
      .withIndex('by_timestamp')
      .filter((q) => q.gt(q.field('timestamp'), cutoff))
      .collect();

    // Aggregate by provider
    const stats = new Map<string, ProviderStats>();

    for (const event of events) {
      if (!event.provider) continue;

      const current = stats.get(event.provider) || {
        provider: event.provider,
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        totalTokens: 0,
      };

      current.totalRequests++;
      if (event.eventType === 'generation_complete') {
        current.successCount++;
        current.avgDuration =
          (current.avgDuration * (current.successCount - 1) +
            (event.duration || 0)) /
          current.successCount;
        current.totalTokens += event.tokensUsed || 0;
      } else if (event.eventType === 'generation_error') {
        current.errorCount++;
      }

      stats.set(event.provider, current);
    }

    return Array.from(stats.values());
  },
});
```

### 8.3 Admin Dashboard Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN ANALYTICS DASHBOARD                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Provider Performance (Last 7 Days)                                   │   │
│  │                                                                      │   │
│  │  Provider    | Success | Error | Avg Time | Tokens Used              │   │
│  │  ────────────┼─────────┼───────┼──────────┼─────────────             │   │
│  │  OpenAI      │  98.5%  │ 1.5%  │  12.3s   │  2.4M                    │   │
│  │  Anthropic   │  99.1%  │ 0.9%  │  8.7s    │  1.8M                    │   │
│  │  DeepSeek    │  97.2%  │ 2.8%  │  15.1s   │  890K                    │   │
│  │  Z.AI        │  96.8%  │ 3.2%  │  18.4s   │  450K                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Generation Trends                                                    │   │
│  │                                                                      │   │
│  │  ███████░░░░░░░░  Projects: 234 (↑12%)                              │   │
│  │  ██████████████░  Phases: 1,021 (↑8%)                               │   │
│  │  █████████░░░░░░  Exports: 156 (↑45% 🚀)                            │   │
│  │  ████░░░░░░░░░░░  Templates: 89 uses                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Recent Errors                                            [View All] │   │
│  │                                                                      │   │
│  │  ⚠️  Rate limit exceeded (OpenAI) - 3 occurrences                   │   │
│  │  ⚠️  Context length exceeded (DeepSeek) - 1 occurrence              │   │
│  │  🔴  Provider timeout (Z.AI) - 2 occurrences                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Security Architecture

### 9.1 Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTH FLOW WITH CLERK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Browser                 Next.js                Clerk              Convex  │
│      │                       │                     │                   │    │
│      │── Request page ──────▶│                     │                   │    │
│      │                       │                     │                   │    │
│      │                       │── Check session ───▶│                   │    │
│      │                       │◀─ JWT token ────────│                   │    │
│      │                       │                     │                   │    │
│      │                       │   (middleware.ts)   │                   │    │
│      │                       │   Auth check        │                   │    │
│      │                       │                     │                   │    │
│      │◀─ Protected page ─────│                     │                   │    │
│      │   (with Convex ctx)   │                     │                   │    │
│      │                       │                     │                   │    │
│      │── Query/Mutation ─────┼─────────────────────┼──────────────────▶│    │
│      │   (JWT in header)     │                     │                   │    │
│      │                       │                     │                   │    │
│      │                       │                     │  Validate JWT     │    │
│      │                       │                     │  Extract userId   │    │
│      │                       │                     │  Check admin role │    │
│      │                       │                     │                   │    │
│      │◀─ Query result ───────┼─────────────────────┼───────────────────│    │
│      │                       │                     │                   │    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Policy note:** Legal routes (`/privacy`, `/terms`) must remain public and unauthenticated regardless of feature flags or auth middleware.

### 9.2 Authorization Levels

```typescript
// convex/lib/auth.ts

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Authentication required');
  }
  return identity.subject; // Clerk user ID
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await requireAuth(ctx);
  const identity = await ctx.auth.getUserIdentity();

  // Check Clerk metadata for admin role
  const metadata = identity?.metadata as { role?: string } | undefined;
  if (metadata?.role !== 'admin') {
    throw new ConvexError('Admin access required');
  }

  return userId;
}

export async function requireProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'projects'>
): Promise<{ userId: string; project: Doc<'projects'> }> {
  const userId = await requireAuth(ctx);
  const project = await ctx.db.get(projectId);

  if (!project || project.userId !== userId) {
    throw new ConvexError('Project not found or access denied');
  }

  return { userId, project };
}
```

### 9.3 Credential Encryption

```typescript
// lib/encryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
}

export function encrypt(plaintext: string, key: string): EncryptedData {
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    iv: iv.toString('base64'),
    data: encrypted,
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt(encrypted: EncryptedData, key: string): string {
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

---

## 10. Deployment Architecture

### 10.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION DEPLOYMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                            Vercel                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Next.js 16 Frontend                       │    │   │
│  │  │                                                              │    │   │
│  │  │  • Edge Runtime for middleware                               │    │   │
│  │  │  • ISR for landing pages                                     │    │   │
│  │  │  • Dynamic routes for project pages                          │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  CDN: Static assets, fonts, images                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Convex Cloud                                 │   │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │   │
│  │  │   Query Engine    │  │  Mutation Engine  │  │  Action Engine  │  │   │
│  │  │   (real-time)     │  │   (transactional) │  │  (async/node)   │  │   │
│  │  └───────────────────┘  └───────────────────┘  └─────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                      Database (0.5GB)                          │  │   │
│  │  │  projects | phases | artifacts | templates | telemetry | ...   │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                   File Storage (1GB)                           │  │   │
│  │  │                   Project ZIP exports                          │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         External Services                            │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │   │
│  │  │   Clerk     │  │   LLM APIs  │  │   (Future) Analytics       │  │   │
│  │  │   Auth      │  │   7 prov.   │  │   PostHog, Mixpanel        │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Environment Variables

```bash
# .env.local (Development)

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_ENCRYPTION_KEY=<32-byte-hex-key>

# Feature Flags (optional)
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_ENABLE_TEMPLATES=true
NEXT_PUBLIC_ENABLE_VERSIONING=true
```

### 10.3 Convex Free Tier Constraints

| Resource     | Limit     | Current Usage | v2.0 Impact      |
| ------------ | --------- | ------------- | ---------------- |
| Database     | 0.5 GB    | ~50 MB        | +30% (versions)  |
| File Storage | 1 GB      | ~100 MB       | Unchanged        |
| Bandwidth    | 1 GB/mo   | ~200 MB       | +20% (streaming) |
| Actions      | Unlimited | ~5K/day       | +50% (telemetry) |

---

## 11. Performance Considerations

### 11.1 Query Optimization

```typescript
// Efficient version history loading
export const getArtifactVersions = query({
  args: { artifactId: v.id('artifacts'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact', (q) => q.eq('artifactId', args.artifactId))
      .order('desc') // Most recent first
      .take(args.limit ?? 50);
  },
});
```

### 11.2 Frontend Performance

- **React.memo** for StreamingArtifact component
- **useDeferredValue** for diff computation
- **Suspense boundaries** for version history loading
- **Optimistic updates** for version restore

### 11.3 LLM Call Optimization

- **50% max_tokens** per section (anti-truncation)
- **Retry with exponential backoff** (3 attempts)
- **Provider failover** if primary times out
- **Content caching** for identical prompts (future)

---

## 12. Migration Strategy

### 12.1 Schema Migration

```typescript
// convex/migrations/v2_schema.ts

export const migrateToV2 = internalMutation({
  handler: async (ctx) => {
    // 1. Add streamStatus to existing artifacts
    const artifacts = await ctx.db.query('artifacts').collect();
    for (const artifact of artifacts) {
      await ctx.db.patch(artifact._id, {
        streamStatus: 'complete',
        currentVersionNumber: 1,
      });
    }

    // 2. Create initial version for each artifact
    for (const artifact of artifacts) {
      await ctx.db.insert('artifactVersions', {
        artifactId: artifact._id,
        version: 1,
        content: artifact.content,
        previewHtml: artifact.previewHtml,
        changeType: 'generated',
        changedBy: 'system',
        createdAt: artifact._creationTime,
        sections: artifact.sections,
      });
    }

    // 3. Seed system templates
    await seedSystemTemplates(ctx);
  },
});
```

### 12.2 Rollback Plan

1. **Database**: All new tables can be dropped without affecting v1 functionality
2. **Schema fields**: New optional fields are backward-compatible
3. **Feature flags**: Disable new features via environment variables
4. **Code**: Maintain v1 branches for 30 days post-launch

---

## 13. Appendices

### 13.1 Glossary

| Term          | Definition                                   |
| ------------- | -------------------------------------------- |
| **Artifact**  | Generated document (brief, PRD, spec, etc.)  |
| **Phase**     | Stage in the spec workflow (7 total in v2)   |
| **Worker**    | Background Convex action that runs LLM calls |
| **Streaming** | Real-time content updates during generation  |
| **Template**  | Pre-configured project starter               |
| **Version**   | Snapshot of an artifact at a point in time   |

### 13.2 References

- [Convex Documentation](https://docs.convex.dev)
- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [Clerk Authentication](https://clerk.com/docs)
- [SpecForge v2.0 PRD](./2026-01-15-specforge-v2-prd.md)

---

## Document History

| Version | Date         | Author            | Changes          |
| ------- | ------------ | ----------------- | ---------------- |
| 1.0     | Jan 15, 2026 | Architecture Team | Initial document |

---

> **Next Steps:**
>
> 1. Review with engineering team
> 2. Create detailed component specs for each epic
> 3. Set up development environment with feature flags
> 4. Begin v2.0-alpha implementation
