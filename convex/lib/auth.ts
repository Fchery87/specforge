import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthenticated');
  }

  // Access the role directly from the JWT claims
  // Clerk JWT template is configured with: "role": "{{user.public_metadata.role}}"
  const role = identity.role as string | undefined;

  if (role !== 'admin') {
    throw new Error('Unauthorized: Admin role required');
  }
}

export async function isAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  // Access the role directly from the JWT claims
  const role = identity.role as string | undefined;
  return role === 'admin';
}
