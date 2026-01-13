'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { getRequiredEncryptionKey } from '../lib/encryption-key';
import { decrypt } from '../lib/encryption';
import { api, internal } from './_generated/api';

// Internal action to get all decrypted system credentials (for use in Convex actions only)
export const getAllDecryptedSystemCredentials = internalAction({
  args: {},
  handler: async (ctx) => {
    const ENCRYPTION_KEY = getRequiredEncryptionKey();

    let configs: any[];
    try {
      configs = (await ctx.runQuery(
        internal.systemCredentials.getAllSystemCredentialsInternal
      )) as any[];
    } catch {
      return {};
    }

    const credentials: Record<
      string,
      {
        apiKey: string;
        zaiEndpointType?: 'paid' | 'coding';
        zaiIsChina?: boolean;
      }
    > = {};

    for (const config of configs || []) {
      // Skip disabled credentials
      if (!config.isEnabled) {
        continue;
      }

      // Decrypt the API key
      if (config.apiKey) {
        try {
          // Convex bytes() type returns ArrayBuffer - convert to Buffer properly
          let buffer: Buffer;
          if (config.apiKey instanceof ArrayBuffer) {
            buffer = Buffer.from(new Uint8Array(config.apiKey));
          } else if (Buffer.isBuffer(config.apiKey)) {
            buffer = config.apiKey;
          } else {
            buffer = Buffer.from(config.apiKey);
          }

          const jsonString = buffer.toString('utf8');
          const encrypted = JSON.parse(jsonString);
          const decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);

          if (decryptedApiKey) {
            credentials[config.provider] = {
              apiKey: decryptedApiKey,
              zaiEndpointType: config.zaiEndpointType,
              zaiIsChina: config.zaiIsChina,
            };
          }
        } catch {
          // Log error without exposing sensitive data
          console.error(
            `[getAllDecryptedSystemCredentials] Failed to decrypt credential for provider: ${config.provider}`
          );
          continue;
        }
      }
    }

    return credentials;
  },
});
