'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { getRequiredEncryptionKey } from '../../lib/encryption-key';
import { encrypt } from '../../lib/encryption';

const ENCRYPTION_KEY = getRequiredEncryptionKey();

/**
 * Saves the GitHub OAuth access token for the current user
 */
export const saveGitHubToken = action({
  args: {
    accessToken: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<{ success: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    try {
      // Encrypt the token
      const encrypted = encrypt(args.accessToken, ENCRYPTION_KEY);
      const encryptedJson = JSON.stringify(encrypted);
      const encryptedBytes = Array.from(Buffer.from(encryptedJson));

      // Store in database
      await ctx.runMutation(api.userConfigs.saveGitHubTokenRaw, {
        encryptedToken: encryptedBytes,
      });

      return { success: true };
    } catch (error) {
      console.error('[saveGitHubToken] Error:', error);
      throw new Error('Failed to save GitHub token');
    }
  },
});

/**
 * Checks if the user has a GitHub token stored
 */
export const hasGitHubToken = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const token = await ctx.runQuery(api.userConfigs.getGitHubTokenRaw);
    return token !== null;
  },
});
