import { z } from 'zod';

/**
 * Strict Zod schema for the Project Constitution.
 * Enforces 2026 architectural standards and ensures the LLM output conforms exactly
 * to the structural requirements needed for "Executable Truth" artifacts.
 */
export const ConstitutionSchema = z.object({
  lockedConstraints: z.object({
    stateInvariants: z.array(z.string()),
    domainRules: z.array(z.string()),
    securityProtocols: z.array(z.string()),
  }),
  architecture: z.object({
    pattern: z.string(),
    stateManagement: z.string(),
    apiDesign: z.string(),
    dataFlow: z.string(),
    rationale: z.string(),
  }),
  techStack: z.object({
    frontend: z.object({
      framework: z.string(),
      version: z.string(),
      language: z.string(),
    }),
    backend: z.object({
      runtime: z.string(),
      framework: z.string(),
      version: z.string(),
    }),
    database: z.object({
      type: z.string(),
      orm: z.string(),
      hosting: z.string(),
    }),
    styling: z.object({
      approach: z.string(),
      uiLibrary: z.string(),
    }),
    keyDependencies: z.array(z.string()),
  }),
  qualityStandards: z.object({
    accessibility: z.object({
      wcagLevel: z.string(),
      targetCompliance: z.union([z.string(), z.number()]),
      requirements: z.array(z.string()),
    }),
    performance: z.object({
      bundleSizeLimit: z.string(),
      ttfbTarget: z.string(),
      lcpTarget: z.string(),
      requirements: z.array(z.string()),
    }),
    security: z.object({
      authentication: z.string(),
      authorization: z.string(),
      requirements: z.array(z.string()),
    }),
    testing: z.object({
      unitCoverage: z.union([z.string(), z.number()]), // Allow number parsing just in case
      integrationRequired: z.boolean(),
      e2eRequired: z.boolean(),
    }),
  }),
  namingConventions: z.object({
    files: z.object({
      components: z.string(),
      utilities: z.string(),
      styles: z.string(),
    }),
    components: z.string(),
    functions: z.string(),
    variables: z.string(),
    constants: z.string(),
  }),
  forbiddenPatterns: z.array(
    z.object({
      pattern: z.string(),
      reason: z.string(),
      alternative: z.string(),
    }),
  ),
  globalConstraints: z.object({
    browserSupport: z.array(z.string()),
    deviceCompatibility: z.array(z.string()),
    compliance: z.array(z.string()),
    deployment: z.object({
      platform: z.string(),
      constraints: z.array(z.string()),
    }),
  }),
});

export type ProjectConstitution = z.infer<typeof ConstitutionSchema>;
