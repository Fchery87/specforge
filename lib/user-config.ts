export function resolveSystemKeyId(params: {
  useSystem: boolean;
  provider: string;
  systemKeyId?: string | null;
}): string | undefined {
  if (!params.useSystem) return undefined;
  if (params.systemKeyId && params.systemKeyId.length > 0) {
    return params.systemKeyId;
  }
  return params.provider;
}
