import { describe, it, expect } from 'vitest';
import { ConstitutionSchema } from '../constitution-schema';

describe('ConstitutionSchema', () => {
  const validConstitution = {
    lockedConstraints: {
      stateInvariants: ['User IDs are immutable'],
      domainRules: ['Prices must be positive'],
      securityProtocols: ['All passwords must be hashed using bcrypt'],
    },
    architecture: {
      pattern: 'Clean Architecture',
      stateManagement: 'Convex',
      apiDesign: 'Convex Actions and Queries',
      dataFlow: 'One-way data flow',
      rationale: 'Scalability and clear separation of concerns',
    },
    techStack: {
      frontend: {
        framework: 'Next.js',
        version: '14.2.0',
        language: 'TypeScript',
      },
      backend: {
        runtime: 'Node.js',
        framework: 'Convex',
        version: '1.14.0',
      },
      database: {
        type: 'Convex',
        orm: 'Convex Schema',
        hosting: 'Convex Cloud',
      },
      styling: {
        approach: 'Tailwind CSS',
        uiLibrary: 'shadcn/ui',
      },
      keyDependencies: ['zod', 'lucide-react'],
    },
    qualityStandards: {
      accessibility: {
        wcagLevel: 'AA',
        targetCompliance: 100,
        requirements: ['Aria labels for all icons'],
      },
      performance: {
        bundleSizeLimit: '200KB',
        ttfbTarget: '< 200ms',
        lcpTarget: '< 2.5s',
        requirements: ['Image optimization'],
      },
      security: {
        authentication: 'Clerk',
        authorization: 'RBAC',
        requirements: ['No secrets in client bundles'],
      },
      testing: {
        unitCoverage: '80%',
        integrationRequired: true,
        e2eRequired: false,
      },
    },
    namingConventions: {
      files: {
        components: 'PascalCase.tsx',
        utilities: 'camelCase.ts',
        styles: 'kebab-case.css',
      },
      components: 'PascalCase',
      functions: 'camelCase',
      variables: 'camelCase',
      constants: 'UPPER_SNAKE_CASE',
    },
    forbiddenPatterns: [
      {
        pattern: 'prop-drilling',
        reason: 'Makes components too coupled and hard to maintain',
        alternative: 'Use React Context or global state',
      },
    ],
    globalConstraints: {
      browserSupport: ['Last 2 versions', 'Not dead'],
      deviceCompatibility: ['Mobile', 'Tablet', 'Desktop'],
      compliance: ['GDPR'],
      deployment: {
        platform: 'Vercel',
        constraints: ['Must deploy in under 5 minutes'],
      },
    },
  };

  it('validates a correct constitution JSON successfully', () => {
    const result = ConstitutionSchema.safeParse(validConstitution);
    expect(result.success).toBe(true);
  });

  it('rejects constitution missing required architectural fields', () => {
    const invalidConstitution = {
      ...validConstitution,
      architecture: {
        pattern: 'Clean Architecture',
        // Missing stateManagement, apiDesign, dataFlow, rationale
      },
    };

    const result = ConstitutionSchema.safeParse(invalidConstitution);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['architecture', 'stateManagement'],
          }),
        ]),
      );
    }
  });

  it('allows percentage string or number for targetCompliance and unitCoverage', () => {
    const stringCompliance = {
      ...validConstitution,
      qualityStandards: {
        ...validConstitution.qualityStandards,
        accessibility: {
          ...validConstitution.qualityStandards.accessibility,
          targetCompliance: '95%',
        },
        testing: {
          ...validConstitution.qualityStandards.testing,
          unitCoverage: 80,
        },
      },
    };

    const result = ConstitutionSchema.safeParse(stringCompliance);
    expect(result.success).toBe(true);
  });
});
