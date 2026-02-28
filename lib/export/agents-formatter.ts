/**
 * AGENTS.md Formatter for Project Context
 *
 * Generates AGENTS.md files that help AI agents understand and work with
 * SpecForge-generated projects. Unlike SKILL.md which is for building from scratch,
 * AGENTS.md is for ongoing development and maintenance of existing projects.
 */

// Note: Doc type not needed for this implementation
// import type { Doc } from '../../convex/_generated/dataModel';

/**
 * Input type for AGENTS.md generation
 */
export interface AgentsMdInput {
  project: {
    _id: string;
    title: string;
    description: string;
    createdAt: number;
  };
  artifacts: {
    brief?: string;
    constitution?: string;
    prd?: string;
    techSpec?: string;
    userStories?: string;
    handoff?: string;
  };
}

/**
 * Generates an AGENTS.md file from project artifacts
 */
export function generateAgentsMd(input: AgentsMdInput): string {
  const { project, artifacts } = input;

  // Parse constitution if available
  const constitution = artifacts.constitution
    ? parseConstitution(artifacts.constitution)
    : null;

  const sections: string[] = [];

  // Header
  sections.push(`# ${project.title}`);
  sections.push('');
  sections.push(
    'This file helps AI agents understand and work with this codebase effectively.',
  );
  sections.push('');

  // Project Context
  sections.push('## Project Context');
  sections.push('');
  sections.push(project.description || 'No description available.');
  sections.push('');

  if (constitution?.lockedConstraints) {
    sections.push('## 🔒 Locked Constraints (Zero-Drift Rules)');
    sections.push(
      '**CRITICAL: You must NEVER violate these rules under any circumstance.**',
    );
    sections.push('');

    if (constitution.lockedConstraints.stateInvariants?.length) {
      sections.push('### State Invariants');
      constitution.lockedConstraints.stateInvariants.forEach((rule) => {
        sections.push(`- ${rule}`);
      });
      sections.push('');
    }

    if (constitution.lockedConstraints.domainRules?.length) {
      sections.push('### Domain Rules');
      constitution.lockedConstraints.domainRules.forEach((rule) => {
        sections.push(`- ${rule}`);
      });
      sections.push('');
    }

    if (constitution.lockedConstraints.securityProtocols?.length) {
      sections.push('### Security Protocols');
      constitution.lockedConstraints.securityProtocols.forEach((rule) => {
        sections.push(`- ${rule}`);
      });
      sections.push('');
    }
  }

  if (constitution?.architecture) {
    sections.push('### Architecture');
    sections.push(`**Pattern:** ${constitution.architecture.pattern}`);
    if (constitution.architecture.stateManagement) {
      sections.push(
        `**State Management:** ${constitution.architecture.stateManagement}`,
      );
    }
    sections.push('');
  }

  if (constitution?.techStack) {
    sections.push('### Tech Stack');
    if (constitution.techStack.frontend?.framework) {
      sections.push(`- Frontend: ${constitution.techStack.frontend.framework}`);
    }
    if (constitution.techStack.backend?.framework) {
      sections.push(`- Backend: ${constitution.techStack.backend.framework}`);
    }
    if (constitution.techStack.database?.type) {
      sections.push(`- Database: ${constitution.techStack.database.type}`);
    }
    sections.push('');
  }

  // Conventions
  if (constitution?.namingConventions || constitution?.globalConstraints) {
    sections.push('## Conventions');
    sections.push('');

    if (constitution.namingConventions) {
      sections.push('### Naming');
      if (constitution.namingConventions.files) {
        sections.push('**Files:**');
        Object.entries(constitution.namingConventions.files).forEach(
          ([key, value]) => {
            sections.push(`- ${key}: ${value}`);
          },
        );
      }
      if (constitution.namingConventions.components) {
        sections.push(
          `- Components: ${constitution.namingConventions.components}`,
        );
      }
      if (constitution.namingConventions.functions) {
        sections.push(
          `- Functions: ${constitution.namingConventions.functions}`,
        );
      }
      sections.push('');
    }

    if (constitution.globalConstraints?.browserSupport) {
      sections.push('### Browser Support');
      if (Array.isArray(constitution.globalConstraints.browserSupport)) {
        constitution.globalConstraints.browserSupport.forEach((browser) => {
          sections.push(`- ${browser}`);
        });
      } else {
        sections.push(`- ${constitution.globalConstraints.browserSupport}`);
      }
      sections.push('');
    }
  }

  // Common Tasks
  sections.push('## Common Tasks');
  sections.push('');

  sections.push('### Adding a New Feature');
  sections.push('1. Review relevant User Stories');
  sections.push('2. Follow the established architecture pattern');
  sections.push('3. Adhere to naming conventions');
  sections.push('4. Write tests for new functionality');
  sections.push('5. Update documentation');
  sections.push('');

  sections.push('### Refactoring');
  sections.push('1. Check for forbidden patterns');
  sections.push('2. Maintain consistency with existing code');
  sections.push('3. Update affected tests');
  sections.push('4. Verify no quality standards are violated');
  sections.push('');

  sections.push('### Debugging');
  sections.push('1. Check Tech Spec for expected behavior');
  sections.push('2. Review User Stories for acceptance criteria');
  sections.push('3. Verify against Quality Standards in Constitution');
  sections.push('');

  // Files to Know
  sections.push('## Key Files');
  sections.push('');

  if (artifacts.constitution) {
    sections.push(
      '- `.specforge/constitution.json` - Project standards and constraints',
    );
  }
  if (artifacts.prd) {
    sections.push('- `docs/PRD.md` - Product requirements');
  }
  if (artifacts.techSpec) {
    sections.push('- `docs/TECH_SPEC.md` - Technical specifications');
  }
  if (artifacts.userStories) {
    sections.push(
      '- `docs/USER_STORIES.md` - User stories and acceptance criteria',
    );
  }
  sections.push('');

  // Quality Standards
  if (constitution?.qualityStandards) {
    sections.push('## Quality Standards');
    sections.push('');
    sections.push('All code changes must meet these standards:');
    sections.push('');

    if (constitution.qualityStandards.accessibility?.wcagLevel) {
      sections.push(
        `- **Accessibility:** WCAG ${constitution.qualityStandards.accessibility.wcagLevel} compliance`,
      );
    }
    if (constitution.qualityStandards.testing?.unitCoverage) {
      sections.push(
        `- **Testing:** ${constitution.qualityStandards.testing.unitCoverage} unit test coverage`,
      );
    }
    if (constitution.qualityStandards.performance?.bundleSizeLimit) {
      sections.push(
        `- **Performance:** ${constitution.qualityStandards.performance.bundleSizeLimit}`,
      );
    }
    sections.push('');
  }

  // Constraints
  if (constitution?.forbiddenPatterns?.length) {
    sections.push('## Constraints');
    sections.push('');
    sections.push('**Forbidden Patterns:**');
    sections.push('');
    constitution.forbiddenPatterns.forEach((pattern) => {
      sections.push(`- ${pattern.pattern} - ${pattern.reason}`);
    });
    sections.push('');
  }

  // Getting Help
  sections.push('## Getting Help');
  sections.push('');
  sections.push('- Check the PRD for product requirements');
  sections.push('- Refer to Tech Spec for implementation details');
  sections.push('- Review User Stories for acceptance criteria');
  sections.push('- Consult the Constitution for architectural decisions');
  sections.push('');

  return sections.join('\n');
}

/**
 * Parsed constitution structure (simplified version)
 */
interface ParsedConstitution {
  lockedConstraints?: {
    stateInvariants?: string[];
    domainRules?: string[];
    securityProtocols?: string[];
  };
  architecture?: {
    pattern?: string;
    stateManagement?: string;
  };
  techStack?: {
    frontend?: {
      framework?: string;
    };
    backend?: {
      framework?: string;
    };
    database?: {
      type?: string;
    };
  };
  qualityStandards?: {
    accessibility?: {
      wcagLevel?: string;
    };
    testing?: {
      unitCoverage?: string;
    };
    performance?: {
      bundleSizeLimit?: string;
    };
  };
  namingConventions?: {
    files?: Record<string, string>;
    components?: string;
    functions?: string;
  };
  globalConstraints?: {
    browserSupport?: string[] | string;
  };
  forbiddenPatterns?: Array<{
    pattern: string;
    reason: string;
  }>;
  /** Raw content when JSON parsing fails */
  _raw?: string;
}

/**
 * Attempts to parse constitution JSON
 * Returns null on failure but logs the error for debugging
 */
function parseConstitution(
  constitutionContent: string,
): ParsedConstitution | null {
  try {
    // Try to extract JSON from markdown code blocks or raw JSON
    const jsonMatch = constitutionContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1] : constitutionContent;

    return JSON.parse(jsonString.trim()) as ParsedConstitution;
  } catch (error) {
    console.warn(
      '[parseConstitution] Failed to parse constitution JSON, will include raw content for debugging. Error:',
      error,
    );
    // Return a minimal structure with raw content so it's not completely lost
    return {
      _raw:
        constitutionContent.substring(0, 2000) +
        (constitutionContent.length > 2000 ? '...' : ''),
    } as unknown as ParsedConstitution;
  }
}

/**
 * Exports AGENTS.md content for download
 */
export function exportAgentsMd(input: AgentsMdInput): {
  filename: string;
  content: string;
} {
  const content = generateAgentsMd(input);

  return {
    filename: 'AGENTS.md',
    content,
  };
}
