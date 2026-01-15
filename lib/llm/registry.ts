import type { LlmModel, UserConfig, ProviderCredentials } from './types';
import { FALLBACK_MODELS } from './chunking';

export interface RegistryEntry {
  model: LlmModel;
  provider: string;
  displayName: string;
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral AI',
  google: 'Google Gemini',
  azure: 'Azure OpenAI',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  zai: 'Z.AI (GLM)',
  minimax: 'Minimax',
};

export const MODEL_REGISTRY: RegistryEntry[] = [
  // OpenAI Models (Current as of 2026)
  {
    model: {
      id: 'gpt-4o',
      provider: 'openai',
      contextTokens: 128000,
      maxOutputTokens: 16384,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'openai',
    displayName: 'GPT-4o',
  },
  {
    model: {
      id: 'gpt-4o-mini',
      provider: 'openai',
      contextTokens: 128000,
      maxOutputTokens: 16384,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'openai',
    displayName: 'GPT-4o Mini',
  },

  // DeepSeek Models (Current as of 2026)
  {
    model: {
      id: 'deepseek-chat',
      provider: 'deepseek',
      contextTokens: 128000,
      maxOutputTokens: 8000,
      defaultMax: 4000,
      enabled: true,
    },
    provider: 'deepseek',
    displayName: 'DeepSeek Chat (V3.2)',
  },

  // Anthropic Models (Current as of 2026)
  {
    model: {
      id: 'claude-opus-4-5',
      provider: 'anthropic',
      contextTokens: 200000,
      maxOutputTokens: 16384,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'anthropic',
    displayName: 'Claude Opus 4.5',
  },
  {
    model: {
      id: 'claude-sonnet-4-5',
      provider: 'anthropic',
      contextTokens: 200000,
      maxOutputTokens: 8192,
      defaultMax: 4000,
      enabled: true,
    },
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
  },
  {
    model: {
      id: 'claude-haiku-4-5',
      provider: 'anthropic',
      contextTokens: 200000,
      maxOutputTokens: 8192,
      defaultMax: 4000,
      enabled: true,
    },
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
  },

  // Mistral Models (Current as of 2026)
  {
    model: {
      id: 'mistral-large-3',
      provider: 'mistral',
      contextTokens: 256000,
      maxOutputTokens: 8192,
      defaultMax: 4000,
      enabled: true,
    },
    provider: 'mistral',
    displayName: 'Mistral Large 3',
  },
  {
    model: {
      id: 'mistral-medium-3-1',
      provider: 'mistral',
      contextTokens: 128000,
      maxOutputTokens: 8192,
      defaultMax: 4000,
      enabled: true,
    },
    provider: 'mistral',
    displayName: 'Mistral Medium 3.1',
  },
  {
    model: {
      id: 'mistral-small-3-2',
      provider: 'mistral',
      contextTokens: 128000,
      maxOutputTokens: 8192,
      defaultMax: 4000,
      enabled: true,
    },
    provider: 'mistral',
    displayName: 'Mistral Small 3.2',
  },

  // Z.AI (GLM) Models
  {
    model: {
      id: 'glm-4.7',
      provider: 'zai',
      contextTokens: 204800,
      maxOutputTokens: 131100,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'zai',
    displayName: 'GLM-4.7',
  },
  {
    model: {
      id: 'glm-4.6',
      provider: 'zai',
      contextTokens: 128000,
      maxOutputTokens: 96000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'zai',
    displayName: 'GLM-4.6',
  },
  {
    model: {
      id: 'glm-4.5',
      provider: 'zai',
      contextTokens: 128000,
      maxOutputTokens: 96000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'zai',
    displayName: 'GLM-4.5',
  },
  {
    model: {
      id: 'glm-4.5-air',
      provider: 'zai',
      contextTokens: 128000,
      maxOutputTokens: 96000,
      defaultMax: 6000,
      enabled: true,
    },
    provider: 'zai',
    displayName: 'GLM-4.5 Air',
  },
  {
    model: {
      id: 'glm-4.5-flash',
      provider: 'zai',
      contextTokens: 128000,
      maxOutputTokens: 96000,
      defaultMax: 6000,
      enabled: true,
    },
    provider: 'zai',
    displayName: 'GLM-4.5 Flash',
  },

  // Minimax Models
  {
    model: {
      id: 'minimax-m2.1',
      provider: 'minimax',
      contextTokens: 1000000,
      maxOutputTokens: 1000000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'minimax',
    displayName: 'MiniMax M2.1',
  },
  {
    model: {
      id: 'minimax-m2.1-lightning',
      provider: 'minimax',
      contextTokens: 1000000,
      maxOutputTokens: 1000000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'minimax',
    displayName: 'MiniMax M2.1 Lightning',
  },
  {
    model: {
      id: 'minimax-m2',
      provider: 'minimax',
      contextTokens: 1000000,
      maxOutputTokens: 1000000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'minimax',
    displayName: 'MiniMax M2',
  },
  {
    model: {
      id: 'minimax-01',
      provider: 'minimax',
      contextTokens: 4000000,
      maxOutputTokens: 4000000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'minimax',
    displayName: 'MiniMax-01 (4M Context)',
  },
];

export function getModelById(modelId: string): LlmModel | null {
  const entry = MODEL_REGISTRY.find((e) => e.model.id === modelId);
  return entry?.model ?? null;
}

export function getModelsByProvider(provider: string): RegistryEntry[] {
  return MODEL_REGISTRY.filter((e) => e.provider === provider);
}

export function getAllModels(): RegistryEntry[] {
  return MODEL_REGISTRY;
}

export function getEnabledModels(): RegistryEntry[] {
  return MODEL_REGISTRY.filter((e) => e.model.enabled !== false);
}

export function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

export function getModelDisplayName(modelId: string): string {
  const entry = MODEL_REGISTRY.find((e) => e.model.id === modelId);
  return entry?.displayName ?? modelId;
}

export interface SystemCredential {
  apiKey: string;
  zaiEndpointType?: 'paid' | 'coding';
  zaiIsChina?: boolean;
}

/**
 * Get the first enabled model for a given provider.
 * Checks database-enabled models first, then falls back to registry.
 */
export function getFirstEnabledModelForProvider(
  provider: string,
  enabledModels?: Array<{ provider: string; modelId: string }>
): string {
  // Try database-enabled models first
  if (enabledModels) {
    const providerModel = enabledModels.find((m) => m.provider === provider);
    if (providerModel) return providerModel.modelId;
  }

  // Fallback to registry
  const registryModel = MODEL_REGISTRY.find(
    (e) => e.provider === provider && e.model.enabled
  );
  return registryModel?.model.id ?? '';
}

/**
 * Validate that a model matches its provider.
 */
export function validateProviderModelMatch(
  provider: string,
  modelId: string
): { valid: boolean; error?: string } {
  if (!modelId) return { valid: false, error: 'No model specified' };

  const model = getModelById(modelId);
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
  // If user provided their own API key
  if (userConfig?.apiKey) {
    return {
      provider: userConfig.provider,
      apiKey: userConfig.apiKey,
      modelId: userConfig.defaultModel,
      zaiEndpointType: userConfig.zaiEndpointType,
      zaiIsChina: userConfig.zaiIsChina,
    };
  }

  // Try to find a system credential for the user's selected provider
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
        zaiEndpointType: systemCred.zaiEndpointType,
        zaiIsChina: systemCred.zaiIsChina,
      };
    }
  }

  // FALLBACK: Use the first enabled system credential
  // This allows admin-configured system credentials to work by default
  if (systemCredentials.size > 0) {
    for (const [provider, systemCred] of systemCredentials.entries()) {
      // Automatically select first enabled model for this provider
      const modelId = getFirstEnabledModelForProvider(provider, enabledModels);

      return {
        provider,
        apiKey: systemCred.apiKey,
        modelId,
        zaiEndpointType: systemCred.zaiEndpointType,
        zaiIsChina: systemCred.zaiIsChina,
      };
    }
  }

  return null;
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
  const sectionNames = ['executive-summary', 'requirements', 'implementation']; // Simplified check
  const requiredTokens = sectionNames.length * 1000; // Minimum rough estimate

  if (model.maxOutputTokens < requiredTokens) {
    return {
      valid: false,
      reason: `Model max output (${model.maxOutputTokens}) may be too small for ${artifactType}`,
    };
  }

  return { valid: true };
}

export type { LlmModel };
