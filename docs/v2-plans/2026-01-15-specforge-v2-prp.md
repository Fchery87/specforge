# SpecForge v2.0 — Project Requirements Plan (PRP)

**Version:** 1.0  
**Date:** January 15, 2026  
**Author:** SpecForge Engineering Lead  
**Status:** Ready for Sprint Planning  
**Dependencies:** [PRD](./2026-01-15-specforge-v2-prd.md) | [Architecture](./2026-01-15-specforge-v2-architecture.md)

---

## 1. Executive Summary

This document translates the SpecForge v2.0 Architecture into an actionable implementation plan with sprint-level granularity, task dependencies, acceptance criteria, and risk mitigation strategies.

### 1.1 Timeline Overview

| Phase      | Duration | Focus                              | Exit Criteria                                |
| ---------- | -------- | ---------------------------------- | -------------------------------------------- |
| **Alpha**  | 4 weeks  | Streaming, Templates, Core Exports | 95% generation success, 40% template usage   |
| **Beta**   | 4 weeks  | Versioning, Tests, All Exports     | Version restore works, test phase functional |
| **Stable** | 2 weeks  | Observability, Polish              | All metrics met, zero P0 bugs                |

### 1.2 Team Allocation

| Role              | Allocation | Primary Focus                                    |
| ----------------- | ---------- | ------------------------------------------------ |
| Frontend Engineer | 100%       | Streaming UI, Template Gallery, Version Diff     |
| Backend Engineer  | 100%       | Convex schema, Workers, Export Engine            |
| Full-Stack Lead   | 50%        | Architecture decisions, code review, integration |
| QA/Testing        | 25%        | Acceptance testing, edge cases                   |

---

## 2. Sprint Breakdown

### 2.1 Alpha Phase: Sprints 1-4

---

#### Sprint 1: Foundation & Schema (Week 1)

**Goal:** Database schema v2 deployed, streaming infrastructure ready

##### Tasks

| ID    | Task                                      | Owner   | Est | Dependencies   | Priority |
| ----- | ----------------------------------------- | ------- | --- | -------------- | -------- |
| S1-01 | Update `schema.ts` with v2 tables         | Backend | 4h  | None           | P0       |
| S1-02 | Add streaming fields to `artifacts` table | Backend | 2h  | S1-01          | P0       |
| S1-03 | Create `templates` table with seed data   | Backend | 3h  | S1-01          | P0       |
| S1-04 | Create `artifactVersions` table           | Backend | 2h  | S1-01          | P1       |
| S1-05 | Create `telemetryEvents` table            | Backend | 2h  | S1-01          | P2       |
| S1-06 | Create `userExportPreferences` table      | Backend | 1h  | S1-01          | P2       |
| S1-07 | Create `testConfigs` table                | Backend | 1h  | S1-01          | P2       |
| S1-08 | Write schema migration script             | Backend | 3h  | S1-01 to S1-07 | P0       |
| S1-09 | Add new indexes for performance           | Backend | 2h  | S1-08          | P1       |
| S1-10 | Deploy schema to dev environment          | Backend | 1h  | S1-09          | P0       |

**Deliverables:**

- [ ] All v2 tables created in Convex
- [ ] Migration script tested on dev
- [ ] Backward compatibility verified

**Acceptance Criteria:**

```
✓ `npx convex deploy` succeeds
✓ Existing v1 data remains intact
✓ New tables queryable via dashboard
```

---

#### Sprint 2: Real-Time Streaming (Week 2)

**Goal:** Content streams to UI during generation

##### Tasks

| ID    | Task                                              | Owner      | Est | Dependencies | Priority |
| ----- | ------------------------------------------------- | ---------- | --- | ------------ | -------- |
| S2-01 | Create `appendPartialContent` internal mutation   | Backend    | 3h  | S1-10        | P0       |
| S2-02 | Modify `generatePhaseWorker` for 50-token flushes | Backend    | 4h  | S2-01        | P0       |
| S2-03 | Update artifact reactive query for streaming      | Backend    | 2h  | S2-02        | P0       |
| S2-04 | Create `StreamingArtifact` component              | Frontend   | 4h  | S2-03        | P0       |
| S2-05 | Add `SectionProgress` component                   | Frontend   | 3h  | S2-04        | P0       |
| S2-06 | Implement Markdown partial rendering              | Frontend   | 4h  | S2-04        | P0       |
| S2-07 | Add Cancel button with `streamStatus` update      | Full-Stack | 3h  | S2-02, S2-04 | P1       |
| S2-08 | Implement estimated time remaining                | Frontend   | 2h  | S2-05        | P2       |
| S2-09 | Test streaming with all 7 LLM providers           | QA         | 4h  | S2-06        | P0       |
| S2-10 | Performance optimization (memoization)            | Frontend   | 2h  | S2-09        | P1       |

**Deliverables:**

- [ ] Real-time content updates visible in UI
- [ ] Progress bar updates per-section
- [ ] Cancel functionality working

**Acceptance Criteria:**

```
✓ First token appears within 500ms
✓ UI updates at least 10 tokens/second
✓ Cancel stops generation within 2 seconds
✓ Partial content preserved on cancel
```

---

#### Sprint 3: Project Templates (Week 3)

**Goal:** Users can create projects from templates

##### Tasks

| ID    | Task                                              | Owner    | Est | Dependencies | Priority |
| ----- | ------------------------------------------------- | -------- | --- | ------------ | -------- |
| S3-01 | Create `getTemplates` query                       | Backend  | 2h  | S1-03        | P0       |
| S3-02 | Create `getTemplateBySlug` query                  | Backend  | 1h  | S3-01        | P0       |
| S3-03 | Seed 6 system templates (SaaS, Mobile, CLI, etc.) | Backend  | 4h  | S3-01        | P0       |
| S3-04 | Modify `createProject` to accept `templateId`     | Backend  | 3h  | S3-03        | P0       |
| S3-05 | Implement template answer copying logic           | Backend  | 3h  | S3-04        | P0       |
| S3-06 | Create `TemplateGallery` component                | Frontend | 4h  | S3-01        | P0       |
| S3-07 | Create `TemplateCard` with hover preview          | Frontend | 3h  | S3-06        | P0       |
| S3-08 | Create `TemplatePreviewModal`                     | Frontend | 3h  | S3-07        | P1       |
| S3-09 | Update `/dashboard/new` page with gallery         | Frontend | 2h  | S3-06        | P0       |
| S3-10 | Implement "Blank Project" fallback                | Frontend | 1h  | S3-09        | P1       |
| S3-11 | Log `template_used` telemetry event               | Backend  | 1h  | S3-04        | P2       |
| S3-12 | Increment template `usageCount`                   | Backend  | 1h  | S3-04        | P2       |

**Template Seed Data:**

```typescript
const SYSTEM_TEMPLATES = [
  {
    name: 'SaaS MVP',
    slug: 'saas-mvp',
    category: 'web-app',
    icon: 'Rocket',
    suggestedStack: ['Next.js 16', 'Convex', 'Clerk', 'Stripe', 'Tailwind'],
    estimatedTimeSaved: 6,
    defaultAnswers: [
      /* 15 pre-filled answers */
    ],
  },
  {
    name: 'Mobile App',
    slug: 'mobile-app',
    category: 'mobile',
    icon: 'Smartphone',
    suggestedStack: ['React Native', 'Expo', 'Supabase'],
    estimatedTimeSaved: 5,
  },
  // ... CLI Tool, Chrome Extension, API Service, Landing Page
];
```

**Deliverables:**

- [ ] Template gallery on new project page
- [ ] 6 system templates seeded
- [ ] Project creation with pre-filled answers

**Acceptance Criteria:**

```
✓ Gallery displays all templates grouped by category
✓ Template selection pre-fills project form
✓ Template answers copied to new project phases
✓ "Blank Project" option always available
```

---

#### Sprint 4: Core Exports (Week 4)

**Goal:** Export to Cursor and AGENTS.md formats

##### Tasks

| ID    | Task                                                   | Owner    | Est | Dependencies | Priority |
| ----- | ------------------------------------------------------ | -------- | --- | ------------ | -------- |
| S4-01 | Create `lib/export/registry.ts`                        | Backend  | 2h  | None         | P0       |
| S4-02 | Implement `generateCursorRules()`                      | Backend  | 4h  | S4-01        | P0       |
| S4-03 | Implement `generateAgentsMd()`                         | Backend  | 3h  | S4-01        | P0       |
| S4-04 | Create `generateExports` Convex action                 | Backend  | 3h  | S4-02, S4-03 | P0       |
| S4-05 | Add export format selection to ZIP generation          | Backend  | 3h  | S4-04        | P0       |
| S4-06 | Create `ExportFormatSelector` component                | Frontend | 3h  | S4-04        | P0       |
| S4-07 | Add export preview modal                               | Frontend | 3h  | S4-06        | P1       |
| S4-08 | Create `saveExportPreferences` mutation                | Backend  | 2h  | S4-06        | P1       |
| S4-09 | **Hide per-artifact ZIP downloads** (per product note) | Frontend | 1h  | None         | P0       |
| S4-10 | Test export content against IDE requirements           | QA       | 4h  | S4-05        | P0       |

> **⚠️ Product Note:** Per-artifact ZIP downloads are not supported in v2.0; hide those UI actions until a real export endpoint exists.

**Deliverables:**

- [ ] `.cursorrules` export working
- [ ] `AGENTS.md` export working
- [ ] Format selection in export UI
- [ ] Per-artifact downloads hidden

**Acceptance Criteria:**

```
✓ Cursor export generates valid .cursorrules file
✓ AGENTS.md follows documented format
✓ Selected formats included in ZIP
✓ Export content < 100k tokens
```

---

### 2.2 Beta Phase: Sprints 5-8

---

#### Sprint 5: Spec Versioning (Week 5)

**Goal:** Version history with diff view

##### Tasks

| ID    | Task                                                        | Owner    | Est  | Dependencies | Priority |
| ----- | ----------------------------------------------------------- | -------- | ---- | ------------ | -------- |
| S5-01 | Create `createArtifactVersion` internal mutation            | Backend  | 3h   | S1-04        | P0       |
| S5-02 | Modify generation to create version on complete             | Backend  | 2h   | S5-01        | P0       |
| S5-03 | Create `getArtifactVersions` query                          | Backend  | 2h   | S5-01        | P0       |
| S5-04 | Create `restoreVersion` mutation                            | Backend  | 3h   | S5-01        | P0       |
| S5-05 | **Cascade delete versions on project delete** (per op note) | Backend  | 2h   | S5-01        | P0       |
| S5-06 | Install `diff-match-patch` library                          | Frontend | 0.5h | None         | P0       |
| S5-07 | Create `VersionHistory` component                           | Frontend | 4h   | S5-03        | P0       |
| S5-08 | Create `DiffViewer` component                               | Frontend | 4h   | S5-06        | P0       |
| S5-09 | Create `/phase/[id]/versions` page                          | Frontend | 2h   | S5-07, S5-08 | P0       |
| S5-10 | Add "History" button to artifact header                     | Frontend | 1h   | S5-09        | P0       |
| S5-11 | Implement version restore confirmation dialog               | Frontend | 2h   | S5-04        | P1       |
| S5-12 | Log `version_restored` telemetry event                      | Backend  | 1h   | S5-04        | P2       |
| S5-13 | Implement 50-version limit with pruning                     | Backend  | 2h   | S5-01        | P1       |

> **⚠️ Operational Note:** When a project is deleted, cascade removal of ZIP storage and any related `generationTasks` to avoid orphaned storage and stale work items.

**Deliverables:**

- [ ] Version history accessible from artifact
- [ ] Side-by-side diff view
- [ ] Version restore functionality
- [ ] Cascade deletes implemented

**Acceptance Criteria:**

```
✓ Every artifact change creates version
✓ Diff highlights additions/deletions
✓ Restore creates new version (non-destructive)
✓ Maximum 50 versions per artifact
✓ Project delete removes all related data
```

---

#### Sprint 6: Test Case Generation (Week 6)

**Goal:** Optional Tests phase generates BDD specs

##### Tasks

| ID    | Task                                         | Owner    | Est | Dependencies | Priority |
| ----- | -------------------------------------------- | -------- | --- | ------------ | -------- |
| S6-01 | Add `tests` to PHASE_CONFIG                  | Backend  | 1h  | None         | P0       |
| S6-02 | Create test generation prompts               | Backend  | 4h  | S6-01        | P0       |
| S6-03 | Implement `generateTestsWorker`              | Backend  | 4h  | S6-02        | P0       |
| S6-04 | Create `TestConfigForm` component            | Frontend | 3h  | S1-07        | P0       |
| S6-05 | Add framework selection (Jest, Vitest, etc.) | Frontend | 2h  | S6-04        | P0       |
| S6-06 | Add "Skip Test Phase" toggle                 | Frontend | 1h  | S6-04        | P1       |
| S6-07 | Update `PhaseStepper` for 7 phases           | Frontend | 2h  | S6-01        | P0       |
| S6-08 | Create test artifact preview                 | Frontend | 3h  | S6-03        | P1       |
| S6-09 | Test BDD output format                       | QA       | 3h  | S6-03        | P0       |
| S6-10 | Test E2E script generation                   | QA       | 3h  | S6-03        | P1       |

**Test Generation Prompts:**

```typescript
const TEST_PROMPTS = {
  unitTests: `Given these user stories, generate unit test specifications...`,
  integrationTests: `For each API endpoint described, create integration test scenarios...`,
  e2eTests: `Create end-to-end test scripts in {framework} format...`,
  acceptanceMatrix: `Convert acceptance criteria to Given/When/Then format...`,
};
```

**Deliverables:**

- [ ] Tests phase appears in workflow
- [ ] BDD test specs generated
- [ ] Framework selection working
- [ ] Skip option functional

**Acceptance Criteria:**

```
✓ Each story generates 3-5 test cases
✓ Tests cover happy path + edge cases
✓ Output matches selected framework syntax
✓ Phase can be skipped without blocking workflow
```

---

#### Sprint 7: Additional Export Formats (Week 7)

**Goal:** Copilot and Kiro exports complete

##### Tasks

| ID    | Task                                                | Owner    | Est | Dependencies | Priority |
| ----- | --------------------------------------------------- | -------- | --- | ------------ | -------- |
| S7-01 | Implement `generateCopilotInstructions()`           | Backend  | 3h  | S4-01        | P0       |
| S7-02 | Implement `generateKiroSteering()`                  | Backend  | 3h  | S4-01        | P0       |
| S7-03 | Add nested directory support for Copilot (.github/) | Backend  | 2h  | S7-01        | P0       |
| S7-04 | Validate YAML output for Kiro                       | Backend  | 2h  | S7-02        | P0       |
| S7-05 | Update `ExportFormatSelector` with new formats      | Frontend | 2h  | S7-01, S7-02 | P0       |
| S7-06 | Add format-specific icons                           | Frontend | 1h  | S7-05        | P2       |
| S7-07 | Create one-click copy button                        | Frontend | 2h  | S4-07        | P2       |
| S7-08 | Test all export formats against real IDEs           | QA       | 4h  | S7-04        | P0       |

**Export Format Validation:**

| Format                            | Validation                               |
| --------------------------------- | ---------------------------------------- |
| `.cursorrules`                    | Markdown syntax, < 100k tokens           |
| `AGENTS.md`                       | Markdown syntax, section headers present |
| `.github/copilot-instructions.md` | Valid path, Markdown syntax              |
| `kiro.steering`                   | Valid YAML, required keys present        |

**Deliverables:**

- [ ] All 4 export formats working
- [ ] Nested directory structure in ZIP
- [ ] Validated against IDE requirements

**Acceptance Criteria:**

```
✓ Copilot instructions placed in .github/
✓ Kiro steering passes YAML validation
✓ All formats loadable in respective IDEs
```

---

#### Sprint 8: Integration & Polish (Week 8)

**Goal:** End-to-end flow tested, edge cases handled

##### Tasks

| ID    | Task                                                    | Owner      | Est | Dependencies | Priority |
| ----- | ------------------------------------------------------- | ---------- | --- | ------------ | -------- |
| S8-01 | Full workflow E2E test (template → export)              | QA         | 8h  | All sprints  | P0       |
| S8-02 | Error handling for LLM failures                         | Backend    | 3h  | S2-02        | P0       |
| S8-03 | Retry logic for streaming interrupts                    | Backend    | 3h  | S8-02        | P0       |
| S8-04 | Loading states for all async operations                 | Frontend   | 3h  | All sprints  | P1       |
| S8-05 | Empty states for templates, versions                    | Frontend   | 2h  | S3-06, S5-07 | P1       |
| S8-06 | Responsive design review                                | Frontend   | 3h  | All sprints  | P1       |
| S8-07 | **Ensure legal routes remain public** (per policy note) | Full-Stack | 1h  | None         | P0       |
| S8-08 | Accessibility audit (keyboard nav, ARIA)                | Frontend   | 4h  | All sprints  | P0       |
| S8-09 | Performance profiling (Lighthouse)                      | Full-Stack | 3h  | All sprints  | P1       |
| S8-10 | Documentation updates                                   | Full-Stack | 4h  | All sprints  | P1       |

> **⚠️ Policy Note:** Legal routes (`/privacy`, `/terms`) must remain public and unauthenticated regardless of feature flags or auth middleware.

**Deliverables:**

- [ ] All happy paths tested
- [ ] Error states handled gracefully
- [ ] Performance meets targets
- [ ] Legal routes verified public

**Acceptance Criteria:**

```
✓ 95% generation success rate
✓ No blocking errors in console
✓ Lighthouse scores 90+
✓ WCAG AA compliance
✓ /privacy and /terms accessible without auth
```

---

### 2.3 Stable Phase: Sprints 9-10

---

#### Sprint 9: Observability Dashboard (Week 9)

**Goal:** Admin can view system metrics

##### Tasks

| ID    | Task                                   | Owner      | Est | Dependencies | Priority |
| ----- | -------------------------------------- | ---------- | --- | ------------ | -------- |
| S9-01 | Implement `getProviderStats` query     | Backend    | 4h  | S1-05        | P0       |
| S9-02 | Implement `getErrorLogs` query         | Backend    | 3h  | S1-05        | P0       |
| S9-03 | Implement `getUsageTrends` query       | Backend    | 3h  | S1-05        | P1       |
| S9-04 | Create admin `/analytics` page         | Frontend   | 2h  | S9-01        | P0       |
| S9-05 | Create `ProviderStatsTable` component  | Frontend   | 3h  | S9-01        | P0       |
| S9-06 | Create `ErrorLogsList` component       | Frontend   | 3h  | S9-02        | P0       |
| S9-07 | Create `UsageTrendsChart` component    | Frontend   | 4h  | S9-03        | P1       |
| S9-08 | Add time range selector (24h/7d/30d)   | Frontend   | 2h  | S9-04        | P1       |
| S9-09 | Implement telemetry data anonymization | Backend    | 2h  | S9-01        | P0       |
| S9-10 | Add admin-only route protection        | Full-Stack | 1h  | S9-04        | P0       |

**Deliverables:**

- [ ] Provider performance table
- [ ] Error logs with categorization
- [ ] Usage trends visualization
- [ ] Admin-only access enforced

**Acceptance Criteria:**

```
✓ Stats load within 200ms
✓ Error logs categorized correctly
✓ Non-admins cannot access /analytics
✓ User data anonymized in telemetry
```

---

#### Sprint 10: Final Polish & Launch (Week 10)

**Goal:** Production-ready release

##### Tasks

| ID     | Task                              | Owner      | Est | Dependencies | Priority |
| ------ | --------------------------------- | ---------- | --- | ------------ | -------- |
| S10-01 | Final E2E regression testing      | QA         | 8h  | All sprints  | P0       |
| S10-02 | Security audit (auth, encryption) | Full-Stack | 4h  | All sprints  | P0       |
| S10-03 | Rate limiting on new endpoints    | Backend    | 3h  | All sprints  | P0       |
| S10-04 | Feature flag cleanup              | Full-Stack | 2h  | All sprints  | P1       |
| S10-05 | Update README and CHANGELOG       | Full-Stack | 2h  | All sprints  | P1       |
| S10-06 | Create v2.0 migration guide       | Full-Stack | 3h  | All sprints  | P1       |
| S10-07 | Deploy to production              | Full-Stack | 2h  | S10-01       | P0       |
| S10-08 | Monitor production metrics        | Full-Stack | 4h  | S10-07       | P0       |
| S10-09 | Hotfix buffer (reserved capacity) | Full-Stack | 8h  | S10-07       | P0       |

**Launch Checklist:**

```
□ All P0 bugs resolved
□ All acceptance criteria met
□ Performance targets achieved
□ Security audit passed
□ Documentation complete
□ Rollback plan tested
□ Team on-call scheduled
```

**Deliverables:**

- [ ] v2.0 deployed to production
- [ ] Monitoring active
- [ ] Documentation published
- [ ] Rollback plan ready

---

## 3. Dependencies & Critical Path

### 3.1 Dependency Graph

```
                                 ┌─────────────────┐
                                 │  S1: Schema     │
                                 │  Foundation     │
                                 └────────┬────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              ▼                           ▼                           ▼
     ┌────────────────┐          ┌────────────────┐          ┌────────────────┐
     │ S2: Streaming  │          │ S3: Templates  │          │ S4: Exports    │
     └────────┬───────┘          └────────┬───────┘          └────────┬───────┘
              │                           │                           │
              │                           │                           │
              ▼                           ▼                           ▼
     ┌────────────────┐          ┌────────────────┐          ┌────────────────┐
     │ S5: Versioning │          │ S6: Test Gen   │          │ S7: More Exps  │
     └────────┬───────┘          └────────┬───────┘          └────────┬───────┘
              │                           │                           │
              └───────────────────────────┼───────────────────────────┘
                                          │
                                          ▼
                                 ┌────────────────┐
                                 │ S8: Integration│
                                 └────────┬───────┘
                                          │
                                          ▼
                                 ┌────────────────┐
                                 │ S9: Analytics  │
                                 └────────┬───────┘
                                          │
                                          ▼
                                 ┌────────────────┐
                                 │ S10: Launch    │
                                 └────────────────┘
```

### 3.2 Critical Path

```
S1 → S2 → S5 → S8 → S10
     ↓
     S3 → S8
     ↓
     S4 → S7 → S8
```

**Risk:** Streaming (S2) is on the critical path. Any delays impact the entire project.

---

## 4. Risk Mitigation

| Risk                                 | Probability | Impact | Mitigation                                          |
| ------------------------------------ | ----------- | ------ | --------------------------------------------------- |
| Streaming architecture complexity    | Medium      | High   | Prototype in week 1, validate with 1 provider first |
| LLM provider streaming inconsistency | Medium      | Medium | Implement fallback for non-streaming providers      |
| Convex free tier limits              | Low         | High   | Monitor usage, implement pruning early              |
| Template answer format mismatch      | Medium      | Low    | Validate template data on import                    |
| Diff algorithm performance           | Low         | Medium | Use Web Workers for large diffs                     |
| Export format spec changes           | Medium      | Medium | Version export formats, maintain compatibility      |

---

## 5. Definition of Done

### 5.1 Task Level

- [ ] Code implements acceptance criteria
- [ ] Unit tests written (if applicable)
- [ ] Code reviewed and approved
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Accessible via keyboard

### 5.2 Sprint Level

- [ ] All P0 tasks completed
- [ ] Demo to stakeholders
- [ ] Sprint retrospective held
- [ ] Documentation updated
- [ ] Deployed to staging

### 5.3 Release Level

- [ ] All acceptance criteria met
- [ ] E2E tests passing
- [ ] Performance targets achieved
- [ ] Security review passed
- [ ] Rollback plan documented
- [ ] On-call rotation scheduled

---

## 6. Communication Plan

| Event               | Frequency | Participants         | Channel      |
| ------------------- | --------- | -------------------- | ------------ |
| Daily Standup       | Daily     | Dev team             | Slack huddle |
| Sprint Planning     | Bi-weekly | Dev team + PM        | Video call   |
| Sprint Review       | Bi-weekly | All stakeholders     | Video call   |
| Sprint Retro        | Bi-weekly | Dev team             | Async doc    |
| Architecture Review | As needed | Full-Stack + Backend | Ad-hoc       |

---

## 7. Success Metrics

### 7.1 Technical Metrics

| Metric                  | Target                    | Measurement        |
| ----------------------- | ------------------------- | ------------------ |
| Streaming latency       | < 500ms first token       | P95 in telemetry   |
| Generation success rate | 98%                       | telemetryEvents    |
| Template adoption       | 40% of new projects       | project.templateId |
| Export usage            | 70% of completed projects | telemetryEvents    |
| Version restore usage   | 50+ users in beta         | telemetryEvents    |

### 7.2 Quality Metrics

| Metric           | Target      | Measurement        |
| ---------------- | ----------- | ------------------ |
| P0 bugs          | 0 at launch | Issue tracker      |
| Test coverage    | 70%         | Vitest coverage    |
| Lighthouse score | 90+         | Automated CI check |
| WCAG compliance  | AA          | Manual audit       |

---

## 8. Appendices

### 8.1 Task Estimation Key

| Estimate | Meaning                       |
| -------- | ----------------------------- |
| 0.5h     | Trivial change, config only   |
| 1h       | Small, well-defined task      |
| 2h       | Moderate complexity           |
| 3h       | Significant complexity        |
| 4h       | Complex, may need research    |
| 8h       | Full day, break into subtasks |

### 8.2 Priority Key

| Priority | Meaning                       |
| -------- | ----------------------------- |
| P0       | Blocks release, must complete |
| P1       | Important, should complete    |
| P2       | Nice to have, defer if needed |

### 8.3 Sprint Velocity Assumptions

- 1 Engineer = 30 productive hours/week
- Buffer: 20% for meetings, review, unforeseen
- Effective capacity: ~24 hours/engineer/sprint

---

## Document History

| Version | Date         | Author           | Changes     |
| ------- | ------------ | ---------------- | ----------- |
| 1.0     | Jan 15, 2026 | Engineering Lead | Initial PRP |

---

> **Next Steps:**
>
> 1. Review PRP with development team
> 2. Refine estimates based on team input
> 3. Set up sprint boards in project management tool
> 4. Begin Sprint 1 on planned start date
