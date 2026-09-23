import type { LlmModel, UserConfig, ProviderCredentials } from './types';
import { FALLBACK_MODELS } from './chunking';
import { FALLBACK_REGISTRY } from './model-data';
import type { RegistryEntry } from './model-data';
import { getFirstEnabledModelForProvider } from './model-catalog';

export interface SystemCredential {
  apiKey: string;
  zaiEndpointType?: 'paid' | 'coding';
  zaiIsChina?: boolean;
}

/**
 * Look up a model by ID, checking DB models first (if provided) then falling
 * back to the hardcoded FALLBACK_REGISTRY. Returns null if not found.
 */
export function getModelById(
  modelId: string,
  dbModels?: Array<{ provider: string; modelId: string; contextTokens: number; maxOutputTokens: number; defaultMax: number }>
): LlmModel | null {
  if (dbModels) {
    const dbModel = dbModels.find((m) => m.modelId === modelId);
    if (dbModel) {
      return {
        id: dbModel.modelId,
        provider: dbModel.provider,
        contextTokens: dbModel.contextTokens,
        maxOutputTokens: dbModel.maxOutputTokens,
        defaultMax: dbModel.defaultMax,
        enabled: true,
      };
    }
  }

  const entry = FALLBACK_REGISTRY.find((e) => e.model.id === modelId);
  if (entry) return entry.model;

  return null;
}

export function validateProviderModelMatch(
  provider: string,
  modelId: string,
  dbModels?: Array<{ provider: string; modelId: string; contextTokens: number; maxOutputTokens: number; defaultMax: number }>
): { valid: boolean; error?: string } {
  if (!modelId) return { valid: false, error: 'No model specified' };

  const model = getModelById(modelId, dbModels);
  if (!model) {
    return { valid: false, error: `Unknown model: ${modelId}` };
  }

  if (model.provider !== provider) {
    return {
      valid: false,
      error: `Model ${modelId} (${model.provider}) doesn't match provider ${provider}`,
    };
  }

  return { valid: true };
}

export function resolveCredentials(
  userConfig: UserConfig | null,
  systemCredentials: Map<string, SystemCredential>,
  enabledModels?: Array<{ provider: string; modelId: string }>
): ProviderCredentials | null {
  if (userConfig?.useSystem) {
    const systemKey = userConfig.systemKeyId ?? userConfig.provider;
    const systemCred = systemCredentials.get(systemKey);
    if (systemCred) {
      return {
        provider: userConfig.provider,
        apiKey: systemCred.apiKey,
        modelId:
          userConfig.defaultModel ||
          getFirstEnabledModelForProvider(userConfig.provider, enabledModels),
        source: 'system',
        zaiEndpointType: systemCred.zaiEndpointType,
        zaiIsChina: systemCred.zaiIsChina,
      };
    }

    if (systemCredentials.size > 0) {
      for (const [provider, systemCred] of systemCredentials.entries()) {
        const modelId = getFirstEnabledModelForProvider(provider, enabledModels);

        return {
          provider,
          apiKey: systemCred.apiKey,
          modelId,
          source: 'system',
          zaiEndpointType: systemCred.zaiEndpointType,
          zaiIsChina: systemCred.zaiIsChina,
        };
      }
    }

    return null;
  }

  if (userConfig?.apiKey) {
    return {
      provider: userConfig.provider,
      apiKey: userConfig.apiKey,
      modelId: userConfig.defaultModel,
      source: 'user',
      zaiEndpointType: userConfig.zaiEndpointType,
      zaiIsChina: userConfig.zaiIsChina,
    };
  }

  if (userConfig?.provider) {
    const systemKey = userConfig.systemKeyId ?? userConfig.provider;
    const systemCred = systemCredentials.get(systemKey);
    if (systemCred) {
      return {
        provider: userConfig.provider,
        apiKey: systemCred.apiKey,
        modelId:
          userConfig.defaultModel ||
          getFirstEnabledModelForProvider(userConfig.provider, enabledModels),
        source: 'system',
        zaiEndpointType: systemCred.zaiEndpointType,
        zaiIsChina: systemCred.zaiIsChina,
      };
    }
  }

  if (systemCredentials.size > 0) {
    for (const [provider, systemCred] of systemCredentials.entries()) {
      const modelId = getFirstEnabledModelForProvider(provider, enabledModels);

      return {
        provider,
        apiKey: systemCred.apiKey,
        modelId,
        source: 'system',
        zaiEndpointType: systemCred.zaiEndpointType,
        zaiIsChina: systemCred.zaiIsChina,
      };
    }
  }

  return null;
}

export function resolveModelForCredentials(
  credentials: ProviderCredentials | null,
  dbModels: Array<{ provider: string; modelId: string; contextTokens: number; maxOutputTokens: number; defaultMax: number }>,
  enabledModels: Array<{ provider: string; modelId: string; contextTokens: number; maxOutputTokens: number; defaultMax: number }>,
): LlmModel {
  const provider = credentials?.provider ?? '';

  if (credentials?.modelId && credentials.modelId !== '') {
    const known = getModelById(credentials.modelId, dbModels);
    if (known) return known;

    return {
      id: credentials.modelId,
      provider,
      contextTokens: 128000,
      maxOutputTokens: 8192,
      defaultMax: 4096,
    };
  }

  const providerModel = enabledModels.find((m) => m.provider === provider);
  if (providerModel) {
    if (credentials) credentials.modelId = providerModel.modelId;
    return {
      id: providerModel.modelId,
      provider: providerModel.provider,
      contextTokens: providerModel.contextTokens,
      maxOutputTokens: providerModel.maxOutputTokens,
      defaultMax: providerModel.defaultMax,
    };
  }

  return getFallbackModel();
}

export function getFallbackModel(modelId?: string): LlmModel {
  if (modelId) {
    const model = getModelById(modelId);
    if (model) return model;
  }
  return FALLBACK_MODELS[0];
}

export function validateModelForArtifact(
  model: LlmModel,
  artifactType: string
): { valid: boolean; reason?: string } {
  const sectionNames = ['executive-summary', 'requirements', 'implementation'];
  const requiredTokens = sectionNames.length * 1000;

  if (model.maxOutputTokens < requiredTokens) {
    return {
      valid: false,
      reason: `Model max output (${model.maxOutputTokens}) may be too small for ${artifactType}`,
    };
  }

  return { valid: true };
}
