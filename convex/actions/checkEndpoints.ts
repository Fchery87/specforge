'use node';

import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { getRequiredEncryptionKey } from '../../lib/encryption-key';
import { decrypt } from '../../lib/encryption';
import { fetchModelDirectory, type ModelsDevProvider } from '../../lib/llm/model-directory';
import { FALLBACK_REGISTRY } from '../../lib/llm/model-data';

interface ProviderEndpointCheck {
  provider: string;
  source: 'system' | 'user';
  isEnabled: boolean;
  configuredEndpoint: string;
  endpointReachable: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  authValid: boolean;
  error?: string;
  liveModelCount?: number;
  sampleLiveModels?: string[];
  modelsDevCount?: number;
  sampleModelsDevModels?: string[];
  fallbackRegistryModels?: string[];
}

export const checkConfiguredEndpoints = action({
  args: {},
  handler: async (ctx): Promise<ProviderEndpointCheck[]> => {
    const ENCRYPTION_KEY = getRequiredEncryptionKey();
    const results: ProviderEndpointCheck[] = [];

    // Fetch system credentials
    interface SystemCredentialRow {
      provider: string;
      apiKey?: ArrayBuffer;
      isEnabled: boolean;
      zaiEndpointType?: 'paid' | 'coding';
      zaiIsChina?: boolean;
    }

    let systemCreds: SystemCredentialRow[] = [];
    try {
      systemCreds = (await ctx.runQuery(
        internal.systemCredentials.getAllSystemCredentialsInternal,
      )) as SystemCredentialRow[];
    } catch (err) {
      console.error('[checkConfiguredEndpoints] Failed to fetch system credentials:', err);
    }

    // Fetch models.dev directory for comparison
    let modelDirectoryProviders: ModelsDevProvider[] = [];
    try {
      modelDirectoryProviders = await fetchModelDirectory();
    } catch (err) {
      console.warn('[checkConfiguredEndpoints] Failed to fetch models.dev directory:', err);
    }

    // Provider default endpoints
    const defaultEndpoints: Record<string, string> = {
      deepseek: 'https://api.deepseek.com',
      openrouter: 'https://openrouter.ai/api/v1',
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      mistral: 'https://api.mistral.ai/v1',
      zai: 'https://open.bigmodel.cn/api/paas/v4',
      minimax: 'https://api.minimax.chat/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      chutes: 'https://llm.chutes.ai/v1',
      groq: 'https://api.groq.com/openai/v1',
      together: 'https://api.together.xyz/v1',
      google: 'https://generativelanguage.googleapis.com/v1',
    };

    for (const cred of systemCreds) {
      if (!cred.apiKey) continue;

      let decryptedKey: string | null = null;
      try {
        let buffer: Buffer;
        if (cred.apiKey instanceof ArrayBuffer) {
          buffer = Buffer.from(new Uint8Array(cred.apiKey));
        } else if (Buffer.isBuffer(cred.apiKey)) {
          buffer = cred.apiKey;
        } else {
          buffer = Buffer.from(cred.apiKey);
        }
        const json = JSON.parse(buffer.toString('utf8'));
        decryptedKey = decrypt(json, ENCRYPTION_KEY);
      } catch (decErr) {
        console.error(`[checkConfiguredEndpoints] Decryption error for ${cred.provider}:`, decErr);
      }

      if (!decryptedKey) {
        results.push({
          provider: cred.provider,
          source: 'system',
          isEnabled: cred.isEnabled,
          configuredEndpoint: defaultEndpoints[cred.provider] || 'unknown',
          endpointReachable: false,
          httpStatus: null,
          responseTimeMs: 0,
          authValid: false,
          error: 'Failed to decrypt API key',
        });
        continue;
      }

      const baseUrl = defaultEndpoints[cred.provider] || `https://api.${cred.provider}.com/v1`;

      // Get models.dev models for this provider
      const devProvider = modelDirectoryProviders.find((p) => p.id === cred.provider);
      const devModelIds = devProvider?.models ? Object.keys(devProvider.models) : [];

      // Get hardcoded fallback registry models
      const fallbackModels = FALLBACK_REGISTRY.filter((e) => e.provider === cred.provider).map(
        (e) => e.model.id,
      );

      // Ping provider endpoint
      const startTime = Date.now();
      let httpStatus: number | null = null;
      let endpointReachable = false;
      let authValid = false;
      let liveModelCount: number | undefined;
      let sampleLiveModels: string[] | undefined;
      let errorMessage: string | undefined;

      try {
        let url = `${baseUrl.replace(/\/+$/, '')}/models`;
        let headers: Record<string, string> = {
          Authorization: `Bearer ${decryptedKey}`,
          Accept: 'application/json',
        };

        if (cred.provider === 'anthropic') {
          headers = {
            'x-api-key': decryptedKey,
            'anthropic-version': '2023-06-01',
            Accept: 'application/json',
          };
        } else if (cred.provider === 'openrouter') {
          headers['HTTP-Referer'] = 'https://specforge.dev';
          headers['X-Title'] = 'SpecForge';
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        httpStatus = response.status;
        endpointReachable = true;

        if (response.ok) {
          authValid = true;
          try {
            const data = (await response.json()) as Record<string, unknown>;
            if (Array.isArray(data.data)) {
              liveModelCount = data.data.length;
              sampleLiveModels = (data.data as Array<{ id?: string; name?: string }>)
                .slice(0, 10)
                .map((m) => m.id || m.name || '');
            } else if (Array.isArray(data.models)) {
              liveModelCount = data.models.length;
              sampleLiveModels = (data.models as Array<{ id?: string; name?: string }>)
                .slice(0, 10)
                .map((m) => m.id || m.name || '');
            }
          } catch {
            // JSON parse error on response body
          }
        } else {
          authValid = false;
          const text = await response.text();
          errorMessage = `HTTP ${response.status}: ${text.slice(0, 150)}`;
        }
      } catch (netErr: unknown) {
        endpointReachable = false;
        errorMessage = netErr instanceof Error ? netErr.message : 'Network request failed';
      }

      const responseTimeMs = Date.now() - startTime;

      results.push({
        provider: cred.provider,
        source: 'system',
        isEnabled: cred.isEnabled,
        configuredEndpoint: baseUrl,
        endpointReachable,
        httpStatus,
        responseTimeMs,
        authValid,
        error: errorMessage,
        liveModelCount,
        sampleLiveModels,
        modelsDevCount: devModelIds.length,
        sampleModelsDevModels: devModelIds.slice(0, 8),
        fallbackRegistryModels: fallbackModels,
      });
    }

    return results;
  },
});
