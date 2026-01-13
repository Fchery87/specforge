export function toPublicUserConfig<T extends { apiKey?: string | null }>(
  config: T | null
): (Omit<T, "apiKey"> & { hasApiKey: boolean }) | null {
  if (!config) return null;
  const { apiKey, ...rest } = config;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
  } as Omit<T, "apiKey"> & { hasApiKey: boolean };
}
