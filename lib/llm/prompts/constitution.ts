/**
 * Constitution Prompt for Project Constitution Generation
 *
 * This prompt generates a Project Constitution during the Brief phase that serves
 * as the single source of truth for all subsequent phases. It ensures consistency
 * across PRD, Tech Spec, User Stories, and Handoff artifacts.
 */

export const CONSTITUTION_PROMPT = `Generate a Project Constitution based on the project brief.

This Constitution is the PRIMARY OBJECTIVE LAYER and the SINGLE SOURCE OF TRUTH that all subsequent phases MUST reference and strictly adhere to. It establishes the "Immutable Truths" and "Locked Constraints" of the system.

## Instructions

Analyze the provided project brief and extract or infer the following constitutional elements with high-precision technical intent:

### 1. Locked Constraints (Immutable Truths)
- **State Invariants:** Core truths about the system's state that must never be violated.
- **Domain Rules:** Foundational business logic rules.
- **Security Protocols:** Non-negotiable security requirements (e.g., "All PII must be encrypted at rest", "Strict RBAC").

### 2. Architecture Decisions (immutable across all phases)
- High-level architecture pattern (e.g., Clean Architecture, Microservices, Monolith, Serverless)
- State management approach (e.g., Redux, Zustand, React Context, Convex)
- API design principles (e.g., REST, GraphQL, tRPC, gRPC)
- Data flow patterns
- Component composition strategy

### 3. Tech Stack Constraints (frameworks, libraries, versions)
- Frontend framework and version (e.g., Next.js 16, React 19, Vue 3)
- Backend/runtime environment (e.g., Node.js 20, Convex, Deno)
- Database and ORM choices (e.g., PostgreSQL with Prisma, MongoDB, Convex)
- Styling approach (e.g., Tailwind CSS, styled-components, CSS Modules)
- Key dependencies with version constraints
- Build tools and bundlers

### 4. Quality Standards (non-negotiable requirements)
- Accessibility level (WCAG 2.2 AA/AAA strict compliance targets)
- Performance budgets (bundle size limits, TTFB targets, LCP thresholds)
- Security requirements (authentication, authorization, OWASP 2026 guidelines)
- Testing coverage requirements (unit, integration, e2e thresholds)
- Code quality standards (linting, formatting, type safety)

### 5. Naming Conventions and Patterns
- File naming conventions (e.g., PascalCase for components, camelCase for utilities)
- Component/class naming patterns
- Directory structure rules
- Import organization rules
- Variable/function naming conventions

### 6. Forbidden Patterns (anti-patterns to explicitly avoid)
- Technologies not to use (e.g., "No jQuery", "Avoid class components")
- Patterns to avoid (e.g., "No prop drilling", "Avoid inline styles")
- Common mistakes to prevent
- Deprecated approaches

### 7. Global Constraints
- Browser support matrix (e.g., "Last 2 versions", "IE11 not supported")
- Device compatibility requirements (mobile, desktop, tablet)
- Compliance requirements (GDPR, SOC2, HIPAA, PCI, etc.)
- Internationalization requirements
- Deployment constraints

## Output Format

Return ONLY a valid JSON object with the following structure:

\`\`\`json
{
  "lockedConstraints": {
    "stateInvariants": ["string - immutable rule about state"],
    "domainRules": ["string - foundational business rule"],
    "securityProtocols": ["string - non-negotiable security rule"]
  },
  "architecture": {
    "pattern": "string - e.g., 'Clean Architecture with Hexagonal Design'",
    "stateManagement": "string - e.g., 'Convex for server state, Zustand for client state'",
    "apiDesign": "string - e.g., 'RESTful with OpenAPI specs'",
    "dataFlow": "string - description of data flow patterns",
    "rationale": "string - why these architectural choices were made"
  },
  "techStack": {
    "frontend": {
      "framework": "string",
      "version": "string",
      "language": "string - e.g., 'TypeScript 5.3'"
    },
    "backend": {
      "runtime": "string",
      "framework": "string",
      "version": "string"
    },
    "database": {
      "type": "string - e.g., 'PostgreSQL'",
      "orm": "string - e.g., 'Prisma'",
      "hosting": "string - e.g., 'Supabase'"
    },
    "styling": {
      "approach": "string - e.g., 'Tailwind CSS'",
      "uiLibrary": "string - e.g., 'shadcn/ui'"
    },
    "keyDependencies": [
      "string - list of critical dependencies with versions"
    ]
  },
  "qualityStandards": {
    "accessibility": {
      "wcagLevel": "string - 'AA' or 'AAA'",
      "targetCompliance": "number - percentage target",
      "requirements": ["string - specific a11y requirements"]
    },
    "performance": {
      "bundleSizeLimit": "string - e.g., '200KB initial'",
      "ttfbTarget": "string - e.g., '< 200ms'",
      "lcpTarget": "string - e.g., '< 2.5s'",
      "requirements": ["string - performance requirements"]
    },
    "security": {
      "authentication": "string - auth approach",
      "authorization": "string - authz approach",
      "requirements": ["string - security requirements"]
    },
    "testing": {
      "unitCoverage": "string - e.g., '> 80%'",
      "integrationRequired": "boolean",
      "e2eRequired": "boolean"
    }
  },
  "namingConventions": {
    "files": {
      "components": "string - e.g., 'PascalCase.tsx'",
      "utilities": "string - e.g., 'camelCase.ts'",
      "styles": "string - e.g., 'kebab-case.module.css'"
    },
    "components": "string - naming pattern for components",
    "functions": "string - naming pattern for functions",
    "variables": "string - naming pattern for variables",
    "constants": "string - naming pattern for constants"
  },
  "forbiddenPatterns": [
    {
      "pattern": "string - what to avoid",
      "reason": "string - why it's forbidden",
      "alternative": "string - what to use instead"
    }
  ],
  "globalConstraints": {
    "browserSupport": ["string - browser versions supported"],
    "deviceCompatibility": ["string - devices to support"],
    "compliance": ["string - compliance frameworks"],
    "deployment": {
      "platform": "string - e.g., 'Vercel'",
      "constraints": ["string - deployment constraints"]
    }
  }
}
\`\`\`

## Important Notes

- Be SPECIFIC with versions and constraints
- Every decision MUST be justified based on the brief
- If information is missing, make reasonable assumptions and document them
- The constitution should be COMPREHENSIVE enough that an AI agent could build the entire project following only this document
- All subsequent phases will reference this constitution - make it authoritative and complete
`;

/**
 * Helper function to inject constitution context into phase prompts
 */
export function injectConstitutionContext(
  basePrompt: string,
  constitution: string,
): string {
  return `${basePrompt}

## PROJECT CONSTITUTION (MUST FOLLOW)
The following Constitution was generated from the project brief and defines immutable standards for this project. ALL decisions in your response MUST align with these constraints:

${constitution}

CRITICAL: Any deviation from the Constitution must be explicitly justified with a compelling technical reason. When in doubt, follow the Constitution exactly.
`;
}
