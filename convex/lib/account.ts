import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { ACCOUNT_SUSPENDED } from '../../lib/account-access';

type DbCtx = QueryCtx | MutationCtx;

export async function requireActiveAccount(ctx: DbCtx): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');
  const row = await ctx.db
    .query('accountRestrictions')
    .withIndex('by_user', (q) => q.eq('userId', identity.subject))
    .unique();
  if (row) throw new Error(ACCOUNT_SUSPENDED);
}

export async function requireActiveAccountAction(ctx: ActionCtx): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');
  const row = await ctx.runQuery(internal.accountRestrictions.getByUser, {
    userId: identity.subject,
  });
  if (row) throw new Error(ACCOUNT_SUSPENDED);
}
