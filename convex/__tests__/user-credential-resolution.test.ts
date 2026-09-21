import { describe, expect, it, vi } from 'vitest';

import { resolveCredentialsForWorker } from '../internalActions';

function makeWorkerCtx(opts: {
  userApiKey?: string;
  systemApiKey?: string;
}) {
  return {
    auth: {
      getUserIdentity: async () => null,
    },
    runAction: vi.fn(async (_ref: unknown, args: unknown) => {
      if (args && typeof args === 'object' && 'userId' in args) {
        const { userId } = args as { userId: string };
        if (opts.userApiKey && userId === 'user-1') {
          return {
            userId: 'user-1',
            provider: 'openai',
            apiKey: opts.userApiKey,
            defaultModel: 'gpt-5-mini',
            useSystem: false,
          };
        }
        return null;
      }
      if (opts.systemApiKey) {
        return { openai: { apiKey: opts.systemApiKey } };
      }
      return {};
    }),
  } as unknown as Parameters<typeof resolveCredentialsForWorker>[0];
}

describe('worker credential resolution', () => {
  it('resolves a user key by userId with null identity', async () => {
    const ctx = makeWorkerCtx({ userApiKey: 'sk-user-123' });
    const resolved = await resolveCredentialsForWorker(
      ctx,
      { provider: 'openai', modelId: 'gpt-5-mini', source: 'user' },
      'user-1',
    );
    expect(resolved?.apiKey).toBe('sk-user-123');
    expect(resolved?.provider).toBe('openai');
  });

  it('still resolves a system key', async () => {
    const ctx = makeWorkerCtx({ systemApiKey: 'sk-system-456' });
    const resolved = await resolveCredentialsForWorker(
      ctx,
      { provider: 'openai', modelId: 'gpt-5-mini', source: 'system' },
      'user-1',
    );
    expect(resolved?.apiKey).toBe('sk-system-456');
  });

  it('returns null when no key exists', async () => {
    const ctx = makeWorkerCtx({});
    const resolved = await resolveCredentialsForWorker(
      ctx,
      { provider: 'openai', modelId: 'gpt-5-mini', source: 'user' },
      'user-1',
    );
    expect(resolved).toBeNull();
  });
});
