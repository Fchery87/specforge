import type { LlmModel } from './types';

export interface RegistryEntry {
  model: LlmModel;
  provider: string;
  displayName: string;
}

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
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

export const FALLBACK_REGISTRY: RegistryEntry[] = [
  // OpenAI Models (pinned 2026-09-19 from https://models.dev/api.json)
  {
    model: {
      id: 'gpt-5.4',
      provider: 'openai',
      contextTokens: 1050000,
      maxOutputTokens: 128000,
      defaultMax: 16000,
      enabled: true,
    },
    provider: 'openai',
    displayName: 'GPT-5.4',
  },
  {
    model: {
      id: 'gpt-5.4-mini',
      provider: 'openai',
      contextTokens: 400000,
      maxOutputTokens: 128000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'openai',
    displayName: 'GPT-5.4 Mini',
  },

  // DeepSeek Models (pinned 2026-09-19 from https://models.dev/api.json)
  {
    model: {
      id: 'deepseek-v4-flash',
      provider: 'deepseek',
      contextTokens: 1000000,
      maxOutputTokens: 384000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'deepseek',
    displayName: 'DeepSeek V4 Flash',
  },
  {
    model: {
      id: 'deepseek-flash',
      provider: 'deepseek',
      contextTokens: 1000000,
      maxOutputTokens: 384000,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'deepseek',
    displayName: 'DeepSeek Flash',
  },
  {
    model: {
      id: 'deepseek-chat',
      provider: 'deepseek',
      contextTokens: 128000,
      maxOutputTokens: 8192,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'deepseek',
    displayName: 'DeepSeek Chat',
  },
  {
    model: {
      id: 'deepseek-reasoner',
      provider: 'deepseek',
      contextTokens: 128000,
      maxOutputTokens: 8192,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'deepseek',
    displayName: 'DeepSeek Reasoner',
  },

  // Google Gemini Models
  {
    model: {
      id: 'gemini-2.5-pro',
      provider: 'google',
      contextTokens: 2000000,
      maxOutputTokens: 65536,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'google',
    displayName: 'Gemini 2.5 Pro',
  },
  {
    model: {
      id: 'gemini-2.5-flash',
      provider: 'google',
      contextTokens: 1000000,
      maxOutputTokens: 65536,
      defaultMax: 8000,
      enabled: true,
    },
    provider: 'google',
    displayName: 'Gemini 2.5 Flash',
  },

  // Anthropic Models
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

  // Mistral Models
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

/**
 * Backward compatibility: MODEL_REGISTRY is now an alias to FALLBACK_REGISTRY
 * @deprecated Use getModelById() for DB-first resolution or FALLBACK_REGISTRY for hardcoded models
 */
export const MODEL_REGISTRY = FALLBACK_REGISTRY;
