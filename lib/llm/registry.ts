import type { LlmModel, UserConfig, ProviderCredentials } from "./types";
import { FALLBACK_MODELS } from "./chunking";

export interface RegistryEntry {
  model: LlmModel;
  provider: string;
  displayName: string;
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  mistral: "Mistral AI",
  google: "Google Gemini",
  azure: "Azure OpenAI",
};

export const MODEL_REGISTRY: RegistryEntry[] = [
  // OpenAI Models
  { model: { id: "gpt-4o", provider: "openai", contextTokens: 128000, maxOutputTokens: 16384, defaultMax: 8000, enabled: true }, provider: "openai", displayName: "GPT-4o" },
  { model: { id: "gpt-4o-mini", provider: "openai", contextTokens: 128000, maxOutputTokens: 16384, defaultMax: 8000, enabled: true }, provider: "openai", displayName: "GPT-4o Mini" },
  { model: { id: "gpt-4-turbo", provider: "openai", contextTokens: 128000, maxOutputTokens: 4096, defaultMax: 2000, enabled: true }, provider: "openai", displayName: "GPT-4 Turbo" },
  { model: { id: "gpt-3.5-turbo", provider: "openai", contextTokens: 16385, maxOutputTokens: 4096, defaultMax: 2000, enabled: true }, provider: "openai", displayName: "GPT-3.5 Turbo" },
  
  // Anthropic Models
  { model: { id: "claude-3-5-sonnet", provider: "anthropic", contextTokens: 200000, maxOutputTokens: 8192, defaultMax: 4000, enabled: true }, provider: "anthropic", displayName: "Claude 3.5 Sonnet" },
  { model: { id: "claude-3-5-haiku", provider: "anthropic", contextTokens: 200000, maxOutputTokens: 8192, defaultMax: 4000, enabled: true }, provider: "anthropic", displayName: "Claude 3.5 Haiku" },
  { model: { id: "claude-3-opus", provider: "anthropic", contextTokens: 200000, maxOutputTokens: 4096, defaultMax: 2000, enabled: true }, provider: "anthropic", displayName: "Claude 3 Opus" },
  { model: { id: "claude-sonnet-4-20250514", provider: "anthropic", contextTokens: 200000, maxOutputTokens: 8192, defaultMax: 4000, enabled: true }, provider: "anthropic", displayName: "Claude Sonnet 4" },
  
  // Mistral Models
  { model: { id: "mistral-large", provider: "mistral", contextTokens: 32000, maxOutputTokens: 4096, defaultMax: 2000, enabled: true }, provider: "mistral", displayName: "Mistral Large" },
  { model: { id: "mistral-medium", provider: "mistral", contextTokens: 32000, maxOutputTokens: 4096, defaultMax: 2000, enabled: true }, provider: "mistral", displayName: "Mistral Medium" },
  { model: { id: "mistral-small", provider: "mistral", contextTokens: 32000, maxOutputTokens: 4096, defaultMax: 2000, enabled: true }, provider: "mistral", displayName: "Mistral Small" },
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

export function resolveCredentials(
  userConfig: UserConfig | null,
  systemCredentials: Map<string, string>
): ProviderCredentials | null {
  // If user wants to use system credentials and has one configured
  if (userConfig?.useSystem && userConfig.systemKeyId) {
    const systemKey = systemCredentials.get(userConfig.systemKeyId);
    if (systemKey) {
      return {
        provider: userConfig.provider,
        apiKey: systemKey,
        modelId: userConfig.defaultModel,
      };
    }
  }

  // If user provided their own API key
  if (userConfig?.apiKey) {
    return {
      provider: userConfig.provider,
      apiKey: userConfig.apiKey,
      modelId: userConfig.defaultModel,
    };
  }

  // Try to find a system credential for the user's selected provider
  if (userConfig?.provider) {
    const systemKey = systemCredentials.get(userConfig.provider);
    if (systemKey) {
      return {
        provider: userConfig.provider,
        apiKey: systemKey,
        modelId: userConfig.defaultModel,
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
  const sectionNames = ["executive-summary", "requirements", "implementation"]; // Simplified check
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
