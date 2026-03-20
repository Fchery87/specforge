'use node';

import { action } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
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

const QUICK_SPEC_SYSTEM_PROMPT =
  'You are a software architect. Produce clear, concise, actionable specifications.';

export function buildQuickSpecPrompt(title: string, description: string): string {
  return `Generate a concise implementation spec for the following:

Title: ${title}
Description: ${description}

Produce a focused spec in markdown with these sections:
## Architecture Decisions
Brief bullet list of key architectural choices.

## Implementation Steps
Numbered list of 3-5 concrete implementation steps.

## Technical Considerations
Brief notes on key constraints, security, or performance considerations.

## Architecture Diagram
A Mermaid diagram showing the key components and their relationships.

Keep the spec concise and actionable. Use mermaid fences for the diagram.`;
}

export const generateQuickSpec = action({
  args: {
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args): Promise<{ content: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    await rateLimiter.limit(ctx, 'generateQuickSpec', { key: identity.subject, throws: true });

    // Resolve credentials using the same pattern as generatePhase
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
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
    let model =
      credentials.modelId
        ? (getModelById(credentials.modelId, enabledModelsFromDb ?? []) ?? getFallbackModel())
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

    try {
      const response = await client.complete(
        buildQuickSpecPrompt(args.title, args.description),
        {
          model: model.id,
          maxTokens: 2048,
          temperature: 0.3,
          systemPrompt: QUICK_SPEC_SYSTEM_PROMPT,
        },
      );

      return { content: response.content };
    } catch (error: any) {
      // Handle specific provider errors with user-friendly messages
      if (error.message?.includes('No instances available') || 
          error.message?.includes('chutes')) {
        throw new Error(
          'The selected AI model is temporarily unavailable. ' +
          'Please try again in a few minutes or switch to a different model in Settings.'
        );
      }
      // Re-throw other errors as-is
      throw error;
    }
  },
});
