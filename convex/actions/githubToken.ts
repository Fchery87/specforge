'use node';

import type { ActionCtx } from '../_generated/server';
import { api } from '../_generated/api';
import { getRequiredEncryptionKey } from '../../lib/encryption-key';
import { decrypt } from '../../lib/encryption';

/** The signed-in user's GitHub OAuth token, decrypted, or null when GitHub is not connected. */
export async function readGitHubToken(ctx: ActionCtx): Promise<string | null> {
  const userConfig = await ctx.runQuery(api.userConfigs.getUserConfigRaw);
  if (!userConfig?.githubAccessToken) return null;
  try {
    const encrypted = JSON.parse(Buffer.from(userConfig.githubAccessToken).toString('utf8'));
    return decrypt(encrypted, getRequiredEncryptionKey());
  } catch {
    throw new Error('The saved GitHub connection could not be read. Reconnect GitHub in Settings.');
  }
}
