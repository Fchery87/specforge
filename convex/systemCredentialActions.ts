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

    // Encrypt the API key if provided
    let encryptedApiKey: ArrayBuffer | null = null;
    if (args.apiKey) {
      const encrypted = encrypt(args.apiKey, ENCRYPTION_KEY);
      encryptedApiKey = Buffer.from(JSON.stringify(encrypted)).buffer;
    }

    // Call the mutation to save the credential
    return await ctx.runMutation(api.systemCredentials.setSystemCredentialRaw, {
      provider: args.provider,
      encryptedApiKey: encryptedApiKey
        ? Array.from(new Uint8Array(encryptedApiKey))
        : null,
      isEnabled: args.isEnabled,
      zaiEndpointType: args.zaiEndpointType,
      zaiIsChina: args.zaiIsChina,
    });
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
