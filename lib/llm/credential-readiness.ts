export type GenerationReadiness =
  | { ready: true }
  | { ready: false; reason: 'no-credentials' };

export interface CheckGenerationReadinessParams {
  userConfig?: {
    apiKey?: unknown;
    provider?: string;
    useSystem?: boolean;
    systemKeyId?: string;
  } | null;
  systemCredentials?:
    | ReadonlyArray<{ provider?: string; keyId?: string; [key: string]: unknown }>
    | Map<string, unknown>
    | ReadonlyMap<string, unknown>
    | Record<string, unknown>;
  enabledModels?: ReadonlyArray<{ provider: string; modelId: string }>;

}

function hasUsableApiKey(apiKey: unknown): boolean {
  if (!apiKey) return false;
  if (typeof apiKey === 'string') return apiKey.trim().length > 0;
  if (Array.isArray(apiKey)) return apiKey.length > 0;
  if (typeof ArrayBuffer !== 'undefined' && apiKey instanceof ArrayBuffer) {
    return apiKey.byteLength > 0;
  }
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(apiKey)) {
    return apiKey.byteLength > 0;
  }
  if (typeof apiKey === 'object') return true;
  return false;
}

interface NormalizedSystemCred {
  keyId?: string;
  provider?: string;
}

function normalizeSystemCredentials(
  systemCredentials?:
    | ReadonlyArray<{ provider?: string; keyId?: string; [key: string]: unknown }>
    | Map<string, unknown>
    | ReadonlyMap<string, unknown>
    | Record<string, unknown>
): NormalizedSystemCred[] {
  if (!systemCredentials) return [];

  const results: NormalizedSystemCred[] = [];

  if (Array.isArray(systemCredentials)) {
    for (const item of systemCredentials) {
      if (!item) continue;
      if (item.isEnabled === false) continue;
      results.push({
        keyId: typeof item.keyId === 'string' ? item.keyId : undefined,
        provider: typeof item.provider === 'string' ? item.provider : undefined,
      });
    }
    return results;
  }

  if (
    systemCredentials instanceof Map ||
    typeof (systemCredentials as ReadonlyMap<string, unknown>).entries ===
      'function'
  ) {
    for (const [key, val] of (
      systemCredentials as ReadonlyMap<string, unknown>
    ).entries()) {

      if (!val) continue;
      if (
        typeof val === 'object' &&
        'isEnabled' in val &&
        (val as { isEnabled?: unknown }).isEnabled === false
      ) {
        continue;
      }
      const valObj =
        typeof val === 'object' ? (val as Record<string, unknown>) : undefined;
      results.push({
        keyId: typeof valObj?.keyId === 'string' ? valObj.keyId : key,
        provider: typeof valObj?.provider === 'string' ? valObj.provider : key,
      });
    }
    return results;
  }

  if (typeof systemCredentials === 'object') {
    for (const [key, val] of Object.entries(systemCredentials)) {
      if (!val) continue;
      if (
        typeof val === 'object' &&
        'isEnabled' in val &&
        (val as { isEnabled?: unknown }).isEnabled === false
      ) {
        continue;
      }
      const valObj =
        typeof val === 'object' ? (val as Record<string, unknown>) : undefined;
      results.push({
        keyId: typeof valObj?.keyId === 'string' ? valObj.keyId : key,
        provider: typeof valObj?.provider === 'string' ? valObj.provider : key,
      });
    }
    return results;
  }

  return results;
}

function hasMatchingCredential(
  entries: NormalizedSystemCred[],
  key: string
): boolean {
  if (!key) return false;
  return entries.some((e) => e.keyId === key || e.provider === key);
}

export function checkGenerationReadiness(
  params: CheckGenerationReadinessParams
): GenerationReadiness {
  const { userConfig, systemCredentials, enabledModels } = params;

  // 1. If userConfig has an apiKey (truthy string, Buffer, array, or object): return { ready: true }
  if (userConfig && hasUsableApiKey(userConfig.apiKey)) {
    return { ready: true };
  }

  const entries = normalizeSystemCredentials(systemCredentials);

  // 2. If userConfig?.useSystem: if systemCredentials has a matching entry for systemKeyId/provider or any system credential exists, return { ready: true }
  if (userConfig?.useSystem) {
    const hasMatching =
      Boolean(userConfig.systemKeyId && hasMatchingCredential(entries, userConfig.systemKeyId)) ||
      Boolean(userConfig.provider && hasMatchingCredential(entries, userConfig.provider));
    if (hasMatching || entries.length > 0) {
      return { ready: true };
    }
  }

  // 3. If userConfig?.provider: if systemCredentials has a matching entry for systemKeyId or provider, return { ready: true }
  if (userConfig?.provider) {
    const hasMatching =
      Boolean(userConfig.systemKeyId && hasMatchingCredential(entries, userConfig.systemKeyId)) ||
      hasMatchingCredential(entries, userConfig.provider);
    if (hasMatching) {
      return { ready: true };
    }
  }

  // 4. If systemCredentials has any entries and any enabledModel matches a system credential provider (or if systemCredentials has entries and enabledModels is empty/undefined), return { ready: true }
  if (entries.length > 0) {
    if (!enabledModels || enabledModels.length === 0) {
      return { ready: true };
    }
    const systemProviders = new Set(
      entries
        .flatMap((e) => [e.provider, e.keyId])
        .filter((p): p is string => Boolean(p))
    );
    const hasMatchingModel = enabledModels.some((m) =>
      systemProviders.has(m.provider)
    );
    if (hasMatchingModel) {
      return { ready: true };
    }
  }

  // 5. Otherwise return { ready: false, reason: 'no-credentials' }
  return { ready: false, reason: 'no-credentials' };
}
