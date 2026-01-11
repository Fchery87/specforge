'use node';

import { action } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { v } from 'convex/values';
import { encrypt, decrypt } from '../lib/encryption';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const ENCRYPTION_KEY =
  process.env.CONVEX_ENCRYPTION_KEY ?? 'default-dev-key-change-in-production';

interface UserConfig {
  userId: string;
  provider: string;
  apiKey?: string;
  defaultModel: string;
  useSystem: boolean;
  zaiEndpointType?: "paid" | "coding";
  zaiIsChina?: boolean;
}

export const getUserConfig = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<UserConfig | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config: any = await ctx.runQuery(api.userConfigs.getUserConfigRaw);
    if (!config) return null;

    // Decrypt the API key
    let decryptedApiKey: string | undefined;
    if (config.apiKey) {
      try {
        const encrypted = JSON.parse(
          Buffer.from(config.apiKey).toString('utf8')
        );
        decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);
      } catch {
        // If decryption fails, return undefined
        decryptedApiKey = undefined;
      }
    }

    return {
      userId: config.userId,
      provider: config.provider,
      apiKey: decryptedApiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
      zaiEndpointType: config.zaiEndpointType,
      zaiIsChina: config.zaiIsChina,
    };
  },
});

export const saveUserConfig = action({
  args: {
    provider: v.string(),
    apiKey: v.optional(v.string()),
    defaultModel: v.string(),
    useSystem: v.boolean(),
    zaiEndpointType: v.optional(v.union(v.literal("paid"), v.literal("coding"))),
    zaiIsChina: v.optional(v.boolean()),
  },
  handler: async (ctx: ActionCtx, args): Promise<Id<'userLlmConfigs'>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    // For new configs, we need either an apiKey or useSystem to be true
    if (!args.apiKey && !args.useSystem) {
      throw new Error(
        'Either an API key or system credential usage must be specified'
      );
    }

    let encryptedApiKey: ArrayBuffer | null = null;
    if (args.apiKey) {
      const encrypted = encrypt(args.apiKey, ENCRYPTION_KEY);
      encryptedApiKey = Buffer.from(JSON.stringify(encrypted)).buffer;
    }

    return await ctx.runMutation(api.userConfigs.saveUserConfigRaw, {
      provider: args.provider,
      encryptedApiKey: encryptedApiKey
        ? Array.from(new Uint8Array(encryptedApiKey))
        : null,
      defaultModel: args.defaultModel,
      useSystem: args.useSystem,
      zaiEndpointType: args.zaiEndpointType,
      zaiIsChina: args.zaiIsChina,
    });
  },
});

export const deleteUserConfig = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    await ctx.runMutation(api.userConfigs.deleteUserConfigRaw);
  },
});
