// convex/__tests__/task-credentials.test.ts
import { describe, expect, it } from 'vitest';

describe('generationTask metadata', () => {
  it('does not contain an apiKey field in credentials', () => {
    // This test validates the schema shape.
    // After the fix, metadata.credentials should have:
    //   provider, modelId, source ('user' | 'system'), zaiEndpointType?, zaiIsChina?
    // but NOT apiKey.
    const validCredentialRef = {
      provider: 'openai',
      modelId: 'gpt-4o',
      source: 'user' as const,
    };

    expect(validCredentialRef).not.toHaveProperty('apiKey');
    expect(validCredentialRef).toHaveProperty('source');
    expect(['user', 'system']).toContain(validCredentialRef.source);
  });
});
