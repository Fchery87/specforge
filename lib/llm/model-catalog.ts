import { FALLBACK_REGISTRY, PROVIDER_DISPLAY_NAMES } from './model-data';
import type { RegistryEntry } from './model-data';

export function getModelsByProvider(provider: string): RegistryEntry[] {
  return FALLBACK_REGISTRY.filter((e) => e.provider === provider);
}

export function getAllModels(): RegistryEntry[] {
  return FALLBACK_REGISTRY;
}

export function getEnabledModels(): RegistryEntry[] {
  return FALLBACK_REGISTRY.filter((e) => e.model.enabled !== false);
}

export function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

export function getModelDisplayName(modelId: string): string {
  const entry = FALLBACK_REGISTRY.find((e) => e.model.id === modelId);
  return entry?.displayName ?? modelId;
}

export function getFirstEnabledModelForProvider(
  provider: string,
  enabledModels?: Array<{ provider: string; modelId: string }>
): string {
  if (enabledModels) {
    const providerModel = enabledModels.find((m) => m.provider === provider);
    if (providerModel) return providerModel.modelId;
  }

  const registryModel = FALLBACK_REGISTRY.find(
    (e) => e.provider === provider && e.model.enabled
  );
  return registryModel?.model.id ?? '';
}
