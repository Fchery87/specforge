'use node';

import type { ActionCtx } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { createLlmClient } from '../../lib/llm/client-factory';
import {
  resolveCredentials,
  resolveModelForCredentials,
  validateProviderModelMatch,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import { fetchModelDirectory } from '../../lib/llm/model-directory';

export interface LlmSession {
  client: NonNullable<ReturnType<typeof createLlmClient>>;
  modelId: string;
}

/**
 * The signed-in user's model and client, resolved the way phase generation resolves them: the
 * user's own key first, then a system credential, then a model the provider actually serves.
 */
export async function openLlmSession(ctx: ActionCtx): Promise<LlmSession> {
  const userConfig = await ctx.runAction(internalApi.userConfigActions.getUserConfigInternal, {});
  const systemCredentialsMap = await ctx.runAction(
    internalApi.internalActions.getAllDecryptedSystemCredentials,
    {},
  );
  const enabledModelsFromDb = await ctx.runQuery(internalApi.llmModels.listEnabledModelsInternal);
  const enabledModels = selectEnabledModels(enabledModelsFromDb ?? []);
  const credentials = resolveCredentials(
    userConfig,
    new Map(Object.entries(systemCredentialsMap ?? {})),
    enabledModels,
  );
  if (!credentials) {
    throw new Error('No LLM credentials configured. Please configure your API keys in Settings.');
  }

  const model = resolveModelForCredentials(credentials, enabledModelsFromDb ?? [], enabledModels);
  const validation = validateProviderModelMatch(credentials.provider, model.id, enabledModelsFromDb ?? []);
  if (!validation.valid) throw new Error(`Configuration error: ${validation.error}`);

  let providerApiEndpoint: string | null = null;
  if (credentials.provider) {
    try {
      const providers = await fetchModelDirectory();
      providerApiEndpoint = providers.find((p) => p.id === credentials.provider)?.api ?? null;
    } catch {
      // Non-fatal: the client falls back to its built-in endpoint.
    }
  }

  const client = createLlmClient(credentials, providerApiEndpoint);
  if (!client) throw new Error('Failed to initialize LLM client. Check your credentials in Settings.');
  return { client, modelId: model.id };
}

/** Replaces a provider's capacity error with one the reader can act on; rethrows anything else. */
export function rethrowLlmError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('No instances available') || message.includes('chutes')) {
    throw new Error(
      'The selected AI model is temporarily unavailable. ' +
        'Please try again in a few minutes or switch to a different model in Settings.',
    );
  }
  throw error;
}
