'use node';

import { action, internalAction } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { getRequiredEncryptionKey } from '../lib/encryption-key';
import { encrypt, decrypt } from '../lib/encryption';
import { resolveSystemKeyId } from '../lib/user-config';
import { toPublicUserConfig } from '../lib/llm/user-config-public';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const ENCRYPTION_KEY = getRequiredEncryptionKey();

interface RawUserConfigRow {
  userId: string;
  provider: string;
  apiKey?: ArrayBuffer;
  defaultModel: string;
  useSystem: boolean;
  systemKeyId?: string;
  zaiEndpointType?: 'paid' | 'coding';
  zaiIsChina?: boolean;
  githubAccessToken?: ArrayBuffer;
}

interface UserConfig {
  userId: string;
  provider: string;
  apiKey?: string;
  defaultModel: string;
  useSystem: boolean;
  systemKeyId?: string;
  zaiEndpointType?: "paid" | "coding";
  zaiIsChina?: boolean;
}

export const getUserConfig = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<UserConfig | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config = (await ctx.runQuery(api.userConfigs.getUserConfigRaw)) as RawUserConfigRow | null;
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

    return toPublicUserConfig({
      userId: config.userId,
      provider: config.provider,
      apiKey: decryptedApiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
      systemKeyId: config.systemKeyId,
      zaiEndpointType: config.zaiEndpointType,
      zaiIsChina: config.zaiIsChina,
    });
  },
});

/**
 * Internal version of getUserConfig that returns the full decrypted config
 * including the API key. Only callable from other server-side actions.
 */
export const getUserConfigInternal = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<UserConfig | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config = (await ctx.runQuery(api.userConfigs.getUserConfigRaw)) as RawUserConfigRow | null;
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
        decryptedApiKey = undefined;
      }
    }

    return {
      userId: config.userId,
      provider: config.provider,
      apiKey: decryptedApiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
      systemKeyId: config.systemKeyId,
      zaiEndpointType: config.zaiEndpointType,
      zaiIsChina: config.zaiIsChina,
    };
  },
});

/**
 * Worker-time resolution by explicit userId. Scheduled workers carry no
 * user identity, so the identity-based getUserConfigInternal returns null
 * there. This bypasses auth and reads by userId instead.
 */
export const getUserConfigByUserIdInternal = internalAction({
  args: { userId: v.string() },
  handler: async (ctx: ActionCtx, args): Promise<UserConfig | null> => {
    const config = (await ctx.runQuery(
      internal.userConfigs.getUserConfigRawByUserId,
      { userId: args.userId },
    )) as RawUserConfigRow | null;
    if (!config) return null;

    let decryptedApiKey: string | undefined;
    if (config.apiKey) {
      try {
        const encrypted = JSON.parse(
          Buffer.from(config.apiKey).toString('utf8')
        );
        decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);
      } catch {
        decryptedApiKey = undefined;
      }
    }

    return {
      userId: config.userId,
      provider: config.provider,
      apiKey: decryptedApiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
      systemKeyId: config.systemKeyId,
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
    systemKeyId: v.optional(v.string()),
    clearApiKey: v.optional(v.boolean()),
    zaiEndpointType: v.optional(v.union(v.literal("paid"), v.literal("coding"))),
    zaiIsChina: v.optional(v.boolean()),
  },
  handler: async (ctx: ActionCtx, args): Promise<Id<'userLlmConfigs'>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    // For new configs, we need either an apiKey or useSystem to be true
    if (!args.apiKey && !args.useSystem && !args.clearApiKey) {
      const existing = (await ctx.runQuery(api.userConfigs.getUserConfigRaw)) as RawUserConfigRow | null;
      if (!existing?.apiKey) {
        throw new Error(
          'Either an API key or system credential usage must be specified'
        );
      }
    }

    const resolvedSystemKeyId = resolveSystemKeyId({
      useSystem: args.useSystem,
      provider: args.provider,
      systemKeyId: args.systemKeyId,
    });

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
      systemKeyId: resolvedSystemKeyId,
      clearApiKey: args.clearApiKey,
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
