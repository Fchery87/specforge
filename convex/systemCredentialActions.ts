'use node';

import { action } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { v } from 'convex/values';
import { encrypt } from '../lib/encryption';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const ENCRYPTION_KEY =
  process.env.CONVEX_ENCRYPTION_KEY ?? 'default-dev-key-change-in-production';

// Set or update system credential for a provider (action wrapper)
export const setSystemCredential = action({
  args: {
    provider: v.string(),
    apiKey: v.optional(v.string()),
    isEnabled: v.boolean(),
    zaiEndpointType: v.optional(
      v.union(v.literal('paid'), v.literal('coding'))
    ),
    zaiIsChina: v.optional(v.boolean()),
  },
  handler: async (ctx: ActionCtx, args): Promise<Id<'systemCredentials'>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    console.log(
      '[setSystemCredential] Saving credential for provider:',
      args.provider
    );
    console.log('[setSystemCredential] Has API key:', !!args.apiKey);
    console.log('[setSystemCredential] Is enabled:', args.isEnabled);

    // Encrypt the API key if provided
    let encryptedBytes: number[] | null = null;
    if (args.apiKey) {
      const encrypted = encrypt(args.apiKey, ENCRYPTION_KEY);
      const jsonString = JSON.stringify(encrypted);
      // IMPORTANT: Don't use Buffer.from().buffer - it returns the entire underlying
      // ArrayBuffer pool which may contain garbage data from other operations.
      // Instead, create a proper byte array from the Buffer directly.
      const buffer = Buffer.from(jsonString, 'utf8');
      encryptedBytes = Array.from(buffer);
      console.log(
        '[setSystemCredential] Encrypted API key successfully, byte length:',
        encryptedBytes.length
      );
      console.log(
        '[setSystemCredential] JSON preview:',
        jsonString.substring(0, 50) + '...'
      );
    }

    // Call the mutation to save the credential
    const result = await ctx.runMutation(
      api.systemCredentials.setSystemCredentialRaw,
      {
        provider: args.provider,
        encryptedApiKey: encryptedBytes,
        isEnabled: args.isEnabled,
        zaiEndpointType: args.zaiEndpointType,
        zaiIsChina: args.zaiIsChina,
      }
    );

    console.log('[setSystemCredential] Credential saved with ID:', result);
    return result;
  },
});

// Delete system credential (pass-through action)
export const deleteSystemCredential = action({
  args: { provider: v.string() },
  handler: async (ctx: ActionCtx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    await ctx.runMutation(api.systemCredentials.deleteSystemCredentialRaw, {
      provider: args.provider,
    });
  },
});
