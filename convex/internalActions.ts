'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { decrypt } from '../lib/encryption';
import { api, internal } from './_generated/api';

const ENCRYPTION_KEY =
  process.env.CONVEX_ENCRYPTION_KEY ?? 'default-dev-key-change-in-production';

// Internal action to get all decrypted system credentials (for use in Convex actions only)
export const getAllDecryptedSystemCredentials = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log(
      '[getAllDecryptedSystemCredentials] STARTING at timestamp:',
      Date.now()
    );
    console.log(
      '[getAllDecryptedSystemCredentials] Checking internal ref:',
      !!internal.systemCredentials
    );
    console.log(
      '[getAllDecryptedSystemCredentials] Checking specific function ref:',
      !!internal.systemCredentials?.getAllSystemCredentialsInternal
    );

    let configs: any[];
    try {
      console.log('[getAllDecryptedSystemCredentials] Calling runQuery...');
      configs = (await ctx.runQuery(
        internal.systemCredentials.getAllSystemCredentialsInternal
      )) as any[];
      console.log(
        '[getAllDecryptedSystemCredentials] Query succeeded, configs count:',
        configs?.length,
        'raw:',
        JSON.stringify(configs)
      );
    } catch (error: any) {
      console.error(
        '[getAllDecryptedSystemCredentials] ERROR querying credentials. Message:',
        error?.message
      );
      console.error(
        '[getAllDecryptedSystemCredentials] ERROR stack:',
        error?.stack
      );
      console.error(
        '[getAllDecryptedSystemCredentials] ERROR full:',
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      return {};
    }

    console.log(
      '[getAllDecryptedSystemCredentials] Retrieved configs from DB:',
      configs?.length || 0
    );

    const credentials: Record<
      string,
      {
        apiKey: string;
        zaiEndpointType?: 'paid' | 'coding';
        zaiIsChina?: boolean;
      }
    > = {};

    for (const config of configs || []) {
      console.log(
        '[getAllDecryptedSystemCredentials] Processing provider:',
        config.provider,
        'isEnabled:',
        config.isEnabled,
        'hasApiKey:',
        !!config.apiKey,
        'apiKeyType:',
        config.apiKey ? Object.prototype.toString.call(config.apiKey) : 'none'
      );

      // Skip disabled credentials
      if (!config.isEnabled) {
        console.log(
          '[getAllDecryptedSystemCredentials] Skipping disabled credential for:',
          config.provider
        );
        continue;
      }

      // Decrypt the API key
      if (config.apiKey) {
        try {
          // Convex bytes() type returns ArrayBuffer - convert to Buffer properly
          console.log(
            '[getAllDecryptedSystemCredentials] Converting ArrayBuffer to Buffer for:',
            config.provider
          );
          console.log(
            '[getAllDecryptedSystemCredentials] apiKey byteLength:',
            config.apiKey.byteLength
          );

          // Handle both ArrayBuffer and Buffer cases
          let buffer: Buffer;
          if (config.apiKey instanceof ArrayBuffer) {
            buffer = Buffer.from(new Uint8Array(config.apiKey));
          } else if (Buffer.isBuffer(config.apiKey)) {
            buffer = config.apiKey;
          } else {
            // Try to handle as a generic object with buffer-like properties
            buffer = Buffer.from(config.apiKey);
          }

          const jsonString = buffer.toString('utf8');
          console.log(
            '[getAllDecryptedSystemCredentials] JSON string preview:',
            jsonString.substring(0, 100) + '...'
          );

          const encrypted = JSON.parse(jsonString);
          console.log(
            '[getAllDecryptedSystemCredentials] Parsed encrypted object keys:',
            Object.keys(encrypted)
          );
          console.log(
            '[getAllDecryptedSystemCredentials] Using encryption key (first 10 chars):',
            ENCRYPTION_KEY.substring(0, 10) + '...'
          );

          const decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);
          console.log(
            '[getAllDecryptedSystemCredentials] Decryption result exists:',
            !!decryptedApiKey
          );
          console.log(
            '[getAllDecryptedSystemCredentials] Decrypted key preview (first 10 chars):',
            decryptedApiKey ? decryptedApiKey.substring(0, 10) + '...' : 'null'
          );

          if (decryptedApiKey) {
            credentials[config.provider] = {
              apiKey: decryptedApiKey,
              zaiEndpointType: config.zaiEndpointType,
              zaiIsChina: config.zaiIsChina,
            };
            console.log(
              '[getAllDecryptedSystemCredentials] Successfully decrypted credential for:',
              config.provider
            );
          } else {
            console.error(
              '[getAllDecryptedSystemCredentials] Decryption returned empty/null for:',
              config.provider
            );
          }
        } catch (error: any) {
          // Log detailed error information
          console.error(
            '[getAllDecryptedSystemCredentials] Failed to decrypt credential for:',
            config.provider
          );
          console.error(
            '[getAllDecryptedSystemCredentials] Error message:',
            error?.message
          );
          console.error(
            '[getAllDecryptedSystemCredentials] Error stack:',
            error?.stack
          );
          continue;
        }
      } else {
        console.log(
          '[getAllDecryptedSystemCredentials] No API key found for:',
          config.provider
        );
      }
    }

    console.log(
      '[getAllDecryptedSystemCredentials] Final credentials providers:',
      Object.keys(credentials)
    );
    return credentials;
  },
});
