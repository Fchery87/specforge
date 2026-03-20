'use node';

import { action } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { createLlmClient } from '../../lib/llm/client-factory';
import {
  resolveCredentials,
  getModelById,
  getFallbackModel,
  getFirstEnabledModelForProvider,
  validateProviderModelMatch,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import { fetchModelDirectory } from '../../lib/llm/model-directory';
import { rateLimiter } from '../rateLimiter';
import { parseSectionPlanResponse } from '../../lib/section-plan-parser';
import type { GeneratedSectionPlan } from '../../lib/section-plan-parser';

const SECTION_PLAN_SYSTEM_PROMPT =
  'You are a software architect. Generate structured section plans for software specification documents.';

export function buildSectionPlanPrompt(
  phaseId: string,
  title: string,
  description: string,
): string {
  return `You are a software architect. Generate a section plan for the ${phaseId} phase of a software specification.

Project: ${title}
Description: ${description}

Generate a JSON array of 4-8 sections for this phase. Each section should have:
- id: unique string (snake_case)
- title: section title
- description: what this section covers (1-2 sentences)
- estimatedTokens: estimated token count (200-1500)
- required: boolean (true for the most essential sections)
- sectionType: one of "technical", "implementation", "planning", "documentation"

Return ONLY a valid JSON array, no other text.`;
}

export const generateSectionPlan = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sectionPlan: GeneratedSectionPlan[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    await rateLimiter.limit(ctx, 'generateSectionPlan', {
      key: identity.subject,
      throws: true,
    });

    const project = await ctx.runQuery(internalApi.internal.getProjectInternal, {
      projectId: args.projectId,
    });
    if (!project || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Resolve credentials — same pattern as generateQuickSpec
    const userConfig = await ctx.runAction(
      internalApi.userConfigActions.getUserConfigInternal,
      {},
    );
    const systemCredentialsMap = await ctx.runAction(
      internalApi.internalActions.getAllDecryptedSystemCredentials,
      {},
    );
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal,
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb ?? []);
    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap ?? {})),
      enabledModels,
    );

    if (!credentials) {
      throw new Error(
        'No LLM credentials configured. Please configure your API keys in Settings.',
      );
    }

    // Resolve model
    const model =
      credentials.modelId
        ? (getModelById(credentials.modelId, enabledModelsFromDb ?? []) ??
          getFallbackModel())
        : credentials.provider
          ? (getModelById(
              getFirstEnabledModelForProvider(credentials.provider, enabledModels),
              enabledModelsFromDb ?? [],
            ) ?? getFallbackModel())
          : getFallbackModel();

    // Validate provider-model match
    const validation = validateProviderModelMatch(
      credentials.provider,
      model.id,
      enabledModelsFromDb ?? [],
    );
    if (!validation.valid) {
      throw new Error(`Configuration error: ${validation.error}`);
    }

    // Fetch provider API endpoint from models.dev
    let providerApiEndpoint: string | null = null;
    if (credentials.provider) {
      try {
        const providers = await fetchModelDirectory();
        const provider = providers.find((p) => p.id === credentials.provider);
        providerApiEndpoint = provider?.api ?? null;
      } catch {
        // Non-fatal: fall back to hardcoded endpoint
      }
    }

    const client = createLlmClient(credentials, providerApiEndpoint);
    if (!client) {
      throw new Error(
        'Failed to initialize LLM client. Check your credentials in Settings.',
      );
    }

    const response = await client.complete(
      buildSectionPlanPrompt(args.phaseId, project.title, project.description),
      {
        model: model.id,
        maxTokens: 2000,
        temperature: 0.3,
        systemPrompt: SECTION_PLAN_SYSTEM_PROMPT,
      },
    );

    const sectionPlan = parseSectionPlanResponse(response.content);

    return { sectionPlan };
  },
});
