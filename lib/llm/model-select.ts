export function selectEnabledModels<
  T extends { enabled: boolean } = {
    enabled: boolean;
    provider: string;
    modelId: string;
    contextTokens: number;
    maxOutputTokens: number;
    defaultMax: number;
  },
>(
  models: T[]
): T[] {
  return models.filter((model) => model.enabled);
}
