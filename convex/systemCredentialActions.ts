'use node';

import { action } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { v } from 'convex/values';
import { encrypt } from '../lib/encryption';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';

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
    await requireAdmin(ctx);

    const ENCRYPTION_KEY = process.env.CONVEX_ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
      throw new Error(
        'CONVEX_ENCRYPTION_KEY environment variable is required. ' +
          'Set it in your Convex dashboard under Settings > Environment Variables.'
      );
    }

    // Encrypt the API key if provided
    let encryptedBytes: number[] | null = null;
    if (args.apiKey) {
      const encrypted = encrypt(args.apiKey, ENCRYPTION_KEY);
      const jsonString = JSON.stringify(encrypted);
      const buffer = Buffer.from(jsonString, 'utf8');
      encryptedBytes = Array.from(buffer);
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

    return result;
  },
});

// Delete system credential (pass-through action)
export const deleteSystemCredential = action({
  args: { provider: v.string() },
  handler: async (ctx: ActionCtx, args): Promise<void> => {
    await requireAdmin(ctx);

    await ctx.runMutation(api.systemCredentials.deleteSystemCredentialRaw, {
      provider: args.provider,
    });
  },
});
