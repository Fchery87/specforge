export function selectEnabledModels<T extends { enabled: boolean }>(
  models: T[]
): T[] {
  return models.filter((model) => model.enabled);
}
