# SpecForge 2026 Implementation Plan

**Date:** February 26, 2026  
**Status:** Draft - Ready for specdriven-agent execution  
**Priority:** P0 → P1 → P2

---

## Executive Summary

Based on 2026 industry research (Spec-Driven Development movement, Anthropic Agent Skills spec, Context Engineering patterns), this plan transforms SpecForge from a document generator into an "Executable Truth" system.

**2026 Industry Context:**
- Shift from "Documentation-centric" to "Executable-centric" specifications
- Context Engineering replacing Prompt Engineering
- Constitutional patterns for cross-phase consistency
- SKILL.md standardized as agent-native format (Anthropic, Cursor, 27+ agents)

---

## Phase 1: Project Constitution (P0)
**Timeline:** Weeks 1-2  
**Priority:** P0 - Critical  
**Effort:** Low  
**Impact:** High (Consistency)

### Goal
Generate a hidden `constitution.md` during the Brief phase that acts as "Source of Truth" for all subsequent phases.

### What is a Constitution?
A Constitution defines **immutable standards** applying to **all work** in the project. It answers: *"What standards apply to every piece of work you do?"*

Think of it like team rules before building a LEGO project:
- What if you want all towers square, but your helper builds round ones?
- What if you decide the roof must be blue, but your helper builds red?

### Implementation

#### 1. Create Constitution Prompt
**File:** `lib/llm/prompts/constitution.ts` (new file)

```typescript
export const CONSTITUTION_PROMPT = `
Generate a Project Constitution based on the project brief.

This Constitution is the SINGLE SOURCE OF TRUTH that all subsequent phases MUST reference.

Include:
1. **Architecture Decisions** (immutable across all phases)
   - High-level architecture pattern (e.g., Clean Architecture, Microservices, Monolith)
   - State management approach
   - API design principles

2. **Tech Stack Constraints** (frameworks, libraries, versions)
   - Frontend framework and version
   - Backend/runtime environment
   - Database and ORM choices
   - Key dependencies with version constraints

3. **Quality Standards** (non-negotiable requirements)
   - Accessibility level (WCAG 2.1 AA/AAA)
   - Performance budgets (bundle size, TTFB, LCP targets)
   - Security requirements (authentication, authorization patterns)
   - Testing coverage requirements

4. **Naming Conventions and Patterns**
   - File naming conventions
   - Component/class naming patterns
   - Directory structure rules

5. **Forbidden Patterns** (anti-patterns to explicitly avoid)
   - Technologies not to use
   - Patterns to avoid
   - Common mistakes to prevent

6. **Global Constraints**
   - Browser support matrix
   - Device compatibility requirements
   - Compliance requirements (GDPR, SOC2, etc.)

Output as structured JSON for programmatic access:
{
  "architecture": { "pattern": "...", "rationale": "..." },
  "techStack": { "frontend": "...", "backend": "...", "database": "..." },
  "qualityStandards": { "accessibility": "...", "performance": "...", "security": "..." },
  "namingConventions": { "files": "...", "components": "..." },
  "forbiddenPatterns": ["..."],
  "globalConstraints": { "browserSupport": "...", "compliance": "..." }
}
`;
```

#### 2. Modify Schema
**File:** `convex/schema.ts`

Add constitution as artifact type:
```typescript
export const artifactTypes = v.union(
  v.literal("brief"),
  v.literal("constitution"),  // NEW
  v.literal("prd"),
  v.literal("techSpec"),
  v.literal("userStories"),
  v.literal("handoff"),
);

// Add artifact configuration
artifacts: defineTable({
  projectId: v.id("projects"),
  type: artifactTypes,
  content: v.string(),
  isHidden: v.optional(v.boolean()),  // NEW - constitution is hidden from user
  // ... existing fields
})
```

#### 3. Generate Constitution in Brief Phase
**File:** `convex/actions/generatePhase.ts`

Modify Brief phase generation:
```typescript
async function generateBriefPhase(ctx, args) {
  // 1. Generate brief content (existing)
  const brief = await generateBrief(ctx, args);
  
  // 2. Generate constitution from brief (NEW)
  const constitution = await generateConstitution(ctx, {
    briefId: brief.id,
    briefContent: brief.content,
  });
  
  // 3. Save both artifacts
  await saveArtifact(ctx, { ...brief, type: "brief" });
  await saveArtifact(ctx, { 
    ...constitution, 
    type: "constitution",
    isHidden: true  // Hidden from user, used for internal consistency
  });
}
```

#### 4. Inject Constitution Context
**File:** `convex/actions/generatePhase.ts` - All phase generators

Modify all phase prompts to include constitution:
```typescript
async function generatePRD(ctx, args) {
  const constitution = await getArtifact(ctx, args.projectId, "constitution");
  
  const prompt = `
    ${PRD_PROMPT}
    
    ## PROJECT CONSTITUTION (MUST FOLLOW)
    ${constitution.content}
    
    CRITICAL: All decisions in this PRD MUST align with the Constitution above.
    Any deviation must be explicitly justified.
  `;
  
  // Generate with constitution context
}
```

### Success Metrics
- Zero inconsistencies between PRD tech stack and Tech Spec implementation details
- 100% of generated artifacts reference constitution constraints
- Manual audit shows <5% deviation from constitutional standards

### Acceptance Criteria
- [ ] Constitution generated automatically during Brief phase
- [ ] Constitution stored as hidden artifact (not in user exports)
- [ ] All phase prompts include constitution context
- [ ] Constitution includes: architecture, tech stack, quality standards, naming conventions, forbidden patterns, global constraints
- [ ] Constitution is JSON-structured for programmatic access

---

## Phase 2: Recursive Self-Critique (P1)
**Timeline:** Weeks 3-4  
**Priority:** P1 - High  
**Effort:** Medium  
**Impact:** High (Quality)

### Goal
Add mandatory Critique & Refine step using a "Critic" model before saving sections.

### What is Self-Critique?
Before finalizing any artifact section, run a separate "Critic" pass that validates against the project's Definition of Done (DoD).

### Implementation

#### 1. Create Critic Prompt
**File:** `lib/llm/prompts/critic.ts` (new file)

```typescript
export const CRITIC_PROMPT = `
You are a Code Reviewer and Quality Assurance expert.

Your task: Critique the following section against the Project Constitution and Definition of Done.

## INPUTS
1. Project Constitution (the rules)
2. Section Content (the work to critique)
3. Section Type (e.g., "API Design", "Component Architecture", "Database Schema")

## DEFINITION OF DONE CRITERIA
Evaluate against:

**Accessibility (WCAG 2.1 AA)**
- [ ] All UI components include proper ARIA labels
- [ ] Color contrast ratios meet standards
- [ ] Keyboard navigation is supported
- [ ] Screen reader compatibility is addressed

**Performance**
- [ ] No N+1 query patterns
- [ ] Lazy loading is considered for heavy assets
- [ ] Bundle size impact is minimized
- [ ] Caching strategy is defined where applicable

**Security**
- [ ] Input validation is explicitly mentioned
- [ ] Authentication/authorization patterns are defined
- [ ] XSS prevention measures are included
- [ ] Sensitive data handling is addressed

**Architecture Alignment**
- [ ] Follows constitution-defined architecture pattern
- [ ] Uses approved tech stack only
- [ ] Adheres to naming conventions
- [ ] Avoids forbidden patterns

**Completeness**
- [ ] All requirements are addressed
- [ ] Edge cases are considered
- [ ] Error handling is defined
- [ ] Testing approach is specified

## OUTPUT FORMAT
Return a structured critique:

\`\`\`json
{
  "passes": boolean,
  "score": number,  // 0-100
  "violations": [
    {
      "category": "accessibility|performance|security|architecture|completeness",
      "severity": "critical|warning|info",
      "issue": "description of the problem",
      "suggestion": "how to fix it"
    }
  ],
  "refinedSection": "improved version of the section if changes needed"
}
\`\`\`

If passes=false, the section must be regenerated with the critique feedback.
`;
```

#### 2. Modify Generation Flow
**File:** `convex/actions/generatePhase.ts`

Add critique step to section generation:
```typescript
async function generateSectionWithCritique(ctx, args) {
  // 1. Initial generation
  const initialSection = await generateSection(ctx, args);
  
  // 2. Critique pass (NEW)
  const critique = await runCritique(ctx, {
    constitution: args.constitution,
    sectionContent: initialSection.content,
    sectionType: args.sectionType,
  });
  
  // 3. If critique fails, refine and retry (up to MAX_RETRIES)
  if (!critique.passes && args.retryCount < MAX_RETRIES) {
    const refined = await regenerateWithFeedback(ctx, {
      original: initialSection,
      critique: critique,
      constitution: args.constitution,
    });
    
    // Recursive call with retry count
    return generateSectionWithCritique(ctx, {
      ...args,
      retryCount: args.retryCount + 1,
      previousAttempt: refined,
    });
  }
  
  // 4. Save final section
  return saveSection(ctx, {
    ...initialSection,
    critique: critique,  // Store critique for transparency
    finalContent: critique.passes ? initialSection.content : critique.refinedSection,
  });
}
```

#### 3. Add Types
**File:** `types/phase.ts` or `convex/schema.ts`

```typescript
export interface CritiqueResult {
  passes: boolean;
  score: number;
  violations: Violation[];
  refinedSection?: string;
}

export interface Violation {
  category: 'accessibility' | 'performance' | 'security' | 'architecture' | 'completeness';
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  suggestion: string;
}
```

#### 4. Add Feature Flag
**File:** `convex/schema.ts` or env config

```typescript
// Allow users to disable critique if token costs are too high
export const generationConfig = {
  enableCritique: v.optional(v.boolean()),  // default: true
  maxCritiqueRetries: v.optional(v.number()),  // default: 2
  critiqueThreshold: v.optional(v.number()),  // min score to pass (default: 80)
};
```

### Cost Considerations
- **Token Usage:** +30-40% increase due to additional LLM calls
- **Mitigation:** 
  - Make critique optional (feature flag)
  - Cache critique results for similar sections
  - Only critique critical sections (e.g., Tech Spec, not Brief)

### Success Metrics
- 90%+ of sections pass critique on first attempt
- Average critique score >85/100
- Zero security vulnerabilities in generated specs
- 100% accessibility compliance in UI-related sections

### Acceptance Criteria
- [ ] Critic prompt validates against WCAG, performance, security, and architecture
- [ ] Critique runs automatically before saving sections
- [ ] Failed critiques trigger automatic regeneration (up to N retries)
- [ ] Critique results stored with sections for transparency
- [ ] Feature flag allows disabling critique mode
- [ ] Configuration for max retries and pass threshold

---

## Phase 3: Agent-Native Artifacts (P1)
**Timeline:** Weeks 5-6  
**Priority:** P1 - High  
**Effort:** Low  
**Impact:** Medium (Utility)

### Goal
Generate `SKILL.md` and `AGENTS.md` in Handoff phase for seamless downstream agent consumption.

### Why Agent-Native Formats?
SKILL.md (Anthropic format) is supported by 27+ AI agents including Claude Code, Cursor, Codex, Gemini CLI. It allows SpecForge to seamlessly hand off to AI-powered IDEs.

### SKILL.md Format Specification
Based on [agentskills.io](https://agentskills.io) and Anthropic docs:

```yaml
---
name: specforge-project-handoff
description: Build project from SpecForge specification
license: MIT
compatibility:
  - Claude Code
  - Cursor
  - Codex
  - Gemini CLI
---

# Instructions for AI Agent

## Project Overview
[Brief summary from Brief phase]

## Architecture
[From constitution - high-level patterns]

## Tech Stack
[From constitution - specific versions and libraries]

## Implementation Guidelines
[Step-by-step derived from Tech Spec and User Stories]

### Phase 1: Setup
[Initial setup instructions]

### Phase 2: Core Implementation
[Main development steps]

### Phase 3: Testing & Validation
[Testing requirements]

## Quality Gates
[From constitution - what must pass before completion]

## Common Patterns
[Reusable patterns from the specs]

## File Structure
[Recommended directory layout]
```

### Implementation

#### 1. Create SKILL.md Formatter
**File:** `lib/export/skill-formatter.ts` (new file)

```typescript
export function generateSkillMd(project: Project, artifacts: Artifacts): string {
  const constitution = artifacts.find(a => a.type === 'constitution');
  const brief = artifacts.find(a => a.type === 'brief');
  const techSpec = artifacts.find(a => a.type === 'techSpec');
  const userStories = artifacts.find(a => a.type === 'userStories');
  
  const yamlFrontmatter = `---
name: ${kebabCase(project.name)}-specforge-handoff
description: Build ${project.name} from specification
license: MIT
compatibility:
  - Claude Code
  - Cursor
  - Codex
---

`;

  const content = `# ${project.name} - Implementation Guide

## Project Overview
${brief?.content.summary || 'No brief available'}

## Architecture
${constitution?.content.architecture?.pattern || 'See full constitution'}

## Tech Stack
${formatTechStack(constitution?.content.techStack)}

## Implementation Phases
${generateImplementationPhases(techSpec, userStories)}

## Quality Gates
${formatQualityStandards(constitution?.content.qualityStandards)}

## Getting Started
1. Review the Constitution in .specforge/constitution.json
2. Follow implementation phases in order
3. Run quality checks after each phase
4. Reference User Stories for acceptance criteria
`;

  return yamlFrontmatter + content;
}
```

#### 2. Create AGENTS.md Formatter
**File:** `lib/export/agents-formatter.ts` (new file)

```typescript
export function generateAgentsMd(project: Project, artifacts: Artifacts): string {
  return `# ${project.name} - Agent Guide

This file helps AI agents understand and work with this codebase effectively.

## Project Context
${generateProjectContext(project, artifacts)}

## Conventions
${generateConventions(artifacts)}

## Common Tasks
${generateCommonTasks(artifacts)}

## Files to Know
${generateKeyFiles(artifacts)}

## Testing
${generateTestingGuide(artifacts)}

## Deployment
${generateDeploymentGuide(artifacts)}
`;
}
```

#### 3. Add to Handoff Export
**File:** `components/handoff/ExportOptions.tsx` (or similar)

Add export options:
- Export as Markdown (existing)
- Export as SKILL.md (NEW - for Claude Code/Cursor)
- Export as AGENTS.md (NEW - for project context)
- Export as JSON (existing)

```typescript
const exportFormats = [
  { value: 'markdown', label: 'Markdown (.md)' },
  { value: 'skill', label: 'Agent Skill (.md) - Claude Code, Cursor' },  // NEW
  { value: 'agents', label: 'Agent Guide (AGENTS.md)' },  // NEW
  { value: 'json', label: 'JSON (.json)' },
];
```

### Success Metrics
- SKILL.md successfully imported into Claude Code
- Cursor recognizes and uses SKILL.md format
- 50%+ of users with AI IDEs use agent-native exports

### Acceptance Criteria
- [ ] SKILL.md follows Anthropic/agentskills.io specification
- [ ] YAML frontmatter includes name, description, license, compatibility
- [ ] Instructions are actionable for AI agents
- [ ] AGENTS.md includes project context and conventions
- [ ] Both formats available in Handoff export UI
- [ ] Export includes all relevant constitution constraints

---

## Phase 4: Interactive Section Planning (P2)
**Timeline:** Weeks 7-10  
**Priority:** P2 - Medium  
**Effort:** High  
**Impact:** High (UX)

### Goal
Show SectionPlan preview before generation, allowing users to toggle sections and add per-section instructions.

### Problem Statement
Currently, users have no visibility into what will be generated until it's done. This leads to:
- Wasted tokens on unwanted sections
- Lack of control over "Logic Architecture"
- Users feeling disconnected from the process

### Solution
Before generating a large artifact (e.g., Tech Spec), show a "Plan Summary" with:
1. List of planned sections
2. Toggle to enable/disable each section
3. Text input for per-section instructions
4. Estimated token count

### Implementation

#### 1. Create Section Plan Types
**File:** `types/phase.ts`

```typescript
export interface SectionPlan {
  id: string;
  title: string;
  description: string;
  estimatedTokens: number;
  required: boolean;  // Some sections are mandatory
}

export interface UserSectionPreferences {
  sectionId: string;
  enabled: boolean;
  customInstructions?: string;
}
```

#### 2. Create Section Plan Preview Component
**File:** `components/phase/SectionPlanPreview.tsx` (new file)

```typescript
export function SectionPlanPreview({ 
  sectionPlans, 
  onPreferencesChange,
  onGenerate 
}: SectionPlanPreviewProps) {
  return (
    <div className="section-plan-preview">
      <h2>Review Generation Plan</h2>
      <p>Toggle sections on/off and add custom instructions</p>
      
      {sectionPlans.map(plan => (
        <SectionPlanItem 
          key={plan.id}
          plan={plan}
          onToggle={(enabled) => handleToggle(plan.id, enabled)}
          onInstructionsChange={(instructions) => 
            handleInstructionsChange(plan.id, instructions)
          }
        />
      ))}
      
      <TokenEstimate sectionPlans={sectionPlans} />
      
      <Button onClick={onGenerate}>
        Generate Selected Sections
      </Button>
    </div>
  );
}

function SectionPlanItem({ plan, onToggle, onInstructionsChange }) {
  return (
    <div className="section-plan-item">
      <Switch 
        checked={plan.enabled} 
        onCheckedChange={onToggle}
        disabled={plan.required}
      />
      <div className="section-info">
        <h3>{plan.title}</h3>
        <p>{plan.description}</p>
        {plan.required && <Badge>Required</Badge>}
      </div>
      <Textarea
        placeholder="Add custom instructions for this section..."
        onChange={(e) => onInstructionsChange(e.target.value)}
      />
    </div>
  );
}
```

#### 3. Modify Phase Container
**File:** `components/phase/PhaseContainer.tsx`

Add plan preview mode:
```typescript
export function PhaseContainer({ phase, projectId }: PhaseContainerProps) {
  const [mode, setMode] = useState<'plan' | 'generating' | 'complete'>('plan');
  const [sectionPlans, setSectionPlans] = useState<SectionPlan[]>([]);
  const [preferences, setPreferences] = useState<UserSectionPreferences[]>([]);
  
  // Fetch section plans on mount
  useEffect(() => {
    fetchSectionPlans(phase, projectId).then(setSectionPlans);
  }, []);
  
  if (mode === 'plan') {
    return (
      <SectionPlanPreview
        sectionPlans={sectionPlans}
        onPreferencesChange={setPreferences}
        onGenerate={() => {
          setMode('generating');
          generateWithPreferences(preferences);
        }}
      />
    );
  }
  
  if (mode === 'generating') {
    return <GenerationProgress preferences={preferences} />;
  }
  
  return <PhaseComplete />;
}
```

#### 4. Backend Support for Preferences
**File:** `convex/actions/generatePhase.ts`

Modify generation to respect preferences:
```typescript
export async function generatePhaseWithPreferences(ctx, args) {
  const { phase, projectId, preferences } = args;
  
  // Filter sections based on user preferences
  const enabledSections = getPhaseSections(phase).filter(section => {
    const pref = preferences.find(p => p.sectionId === section.id);
    return pref?.enabled ?? true;  // Default to enabled
  });
  
  // Generate each enabled section with custom instructions
  for (const section of enabledSections) {
    const pref = preferences.find(p => p.sectionId === section.id);
    
    await generateSection(ctx, {
      ...section,
      customInstructions: pref?.customInstructions,
    });
  }
}
```

#### 5. Create Section Plans for Each Phase
**File:** `lib/phase/section-plans.ts` (new file)

```typescript
export const techSpecSectionPlans: SectionPlan[] = [
  {
    id: 'overview',
    title: 'Technical Overview',
    description: 'High-level technical approach and rationale',
    estimatedTokens: 2000,
    required: true,
  },
  {
    id: 'architecture',
    title: 'Architecture Diagram',
    description: 'System architecture and component relationships',
    estimatedTokens: 3000,
    required: true,
  },
  {
    id: 'data-model',
    title: 'Data Model',
    description: 'Database schema and entity relationships',
    estimatedTokens: 2500,
    required: false,
  },
  {
    id: 'api-design',
    title: 'API Design',
    description: 'REST/GraphQL endpoints and schemas',
    estimatedTokens: 4000,
    required: false,
  },
  // ... more sections
];
```

### Success Metrics
- 70%+ of users review section plan before generating
- Average 2-3 sections disabled per generation (token savings)
- 40%+ of sections have custom instructions added
- User satisfaction score increases 20%+

### Acceptance Criteria
- [ ] Section plan preview displayed before generation
- [ ] Users can toggle sections on/off
- [ ] Required sections cannot be disabled
- [ ] Per-section custom instruction input
- [ ] Token count estimate shown
- [ ] Backend respects user preferences
- [ ] Graceful handling if generation fails mid-way

---

## Technical Architecture

### Dependencies
- Constitution generation requires hidden artifact storage support
- Critique mode requires additional LLM budget (+30-40%)
- Interactive UI requires real-time state management

### Feature Flags
All features should be behind feature flags for gradual rollout:

```typescript
// lib/config/features.ts
export const features = {
  constitution: process.env.FEATURE_CONSTITUTION === 'true',
  critique: process.env.FEATURE_CRITIQUE === 'true',
  agentArtifacts: process.env.FEATURE_AGENT_ARTIFACTS === 'true',
  interactivePlanning: process.env.FEATURE_INTERACTIVE_PLANNING === 'true',
};
```

### Database Schema Changes

```typescript
// convex/schema.ts additions

// Add to artifacts table
artifacts: defineTable({
  // ... existing fields
  isHidden: v.optional(v.boolean()),
  critique: v.optional(v.object({
    passes: v.boolean(),
    score: v.number(),
    violations: v.array(v.any()),
  })),
})

// Add generation preferences table
sectionPreferences: defineTable({
  projectId: v.id("projects"),
  phase: v.string(),
  sectionId: v.string(),
  enabled: v.boolean(),
  customInstructions: v.optional(v.string()),
  createdAt: v.number(),
}),
```

---

## Implementation Order

### Week 1-2: Project Constitution (P0)
1. Day 1-2: Create constitution prompt and types
2. Day 3-4: Modify Brief phase to generate constitution
3. Day 5-6: Inject constitution into all phase prompts
4. Day 7-10: Testing and refinement

### Week 3-4: Recursive Self-Critique (P1)
1. Day 1-3: Create critic prompt and types
2. Day 4-7: Implement critique flow with retry logic
3. Day 8-10: Add feature flags and configuration

### Week 5-6: Agent-Native Artifacts (P1)
1. Day 1-3: Create SKILL.md formatter
2. Day 4-5: Create AGENTS.md formatter
3. Day 6-10: Add to Handoff export UI

### Week 7-10: Interactive Section Planning (P2)
1. Day 1-5: Create SectionPlan types and backend support
2. Day 6-10: Build SectionPlanPreview UI component
3. Day 11-15: Integration with PhaseContainer
4. Day 16-20: Testing and polish

---

## Success Metrics Summary

| Feature | Primary Metric | Target |
|---------|---------------|--------|
| Constitution | Cross-phase consistency | <5% deviation |
| Critique | Section quality score | >85/100 |
| Agent Artifacts | Export adoption (AI IDE users) | >50% |
| Interactive Planning | Plan review rate | >70% |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Token costs too high (critique) | Feature flag + caching |
| Constitution drift over time | Versioning + update prompts |
| SKILL.md format changes | Monitor agentskills.io spec |
| UI complexity (interactive) | Progressive enhancement |
| User overwhelm (too many options) | Smart defaults + presets |

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Set up feature flags** in environment config
3. **Begin P0 implementation** (Project Constitution)
4. **Create test harness** for critique validation
5. **Draft SKILL.md examples** for user testing

---

## References

- [Spec-Driven Development in the Age of AI](https://medium.com/@nprasads/spec-driven-development-in-the-age-of-ai-from-specs-as-documents-to-specs-as-executable-truth-9b9e066712b1) - Nagaprasad Sathyanarayana, Feb 2026
- [Agent Skills Specification](https://agentskills.io) - agentskills.io
- [SKILL.md Format](https://www.mdskills.ai/specs/skill-md) - mdskills.ai
- [Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Anthropic, Sep 2025
- [Building Your AI Development Constitution](https://wadewoolwine.com/blog/building-your-ai-development-constitution-the-essential-framework) - Wade Woolwine, Nov 2025
- [Anthropic Skills GitHub](https://github.com/anthropics/skills) - Official reference implementations

---

**Status:** Ready for specdriven-agent execution  
**Last Updated:** February 26, 2026
