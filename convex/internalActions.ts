'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { decrypt } from '../lib/encryption';
import { api } from './_generated/api';

const ENCRYPTION_KEY =
  process.env.CONVEX_ENCRYPTION_KEY ?? 'default-dev-key-change-in-production';

// Internal action to get all decrypted system credentials (for use in Convex actions only)
export const getAllDecryptedSystemCredentials = internalAction({
  args: {},
  handler: async (ctx) => {
    const configs = (await ctx.runQuery(
      api.systemCredentials.getAllSystemCredentials
    )) as any[];
    const credentials: Record<
      string,
      {
        apiKey: string;
        zaiEndpointType?: 'paid' | 'coding';
        zaiIsChina?: boolean;
      }
    > = {};

    for (const config of configs) {
      // Skip disabled credentials
      if (!config.isEnabled) continue;

      // Decrypt the API key
      if (config.apiKey) {
        try {
          const encrypted = JSON.parse(
            Buffer.from(config.apiKey).toString('utf8')
          );
          const decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);
          if (decryptedApiKey) {
            credentials[config.provider] = {
              apiKey: decryptedApiKey,
              zaiEndpointType: config.zaiEndpointType,
              zaiIsChina: config.zaiIsChina,
            };
          }
        } catch {
          // Skip credentials that can't be decrypted
          continue;
        }
      }
    }

    return credentials;
  },
});
