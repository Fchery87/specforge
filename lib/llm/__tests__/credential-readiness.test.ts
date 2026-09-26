import { describe, it, expect } from 'vitest';
import { checkGenerationReadiness } from '../credential-readiness';

describe('checkGenerationReadiness', () => {
  it('user key gives ready: true', () => {
    const result = checkGenerationReadiness({
      userConfig: {
        apiKey: 'user-api-key',
        provider: 'openai',
      },
    });

    expect(result).toEqual({ ready: true });
  });

  it('system key for an enabled model gives ready: true', () => {
    const result = checkGenerationReadiness({
      systemCredentials: [
        { provider: 'openai', keyId: 'openai-sys' },
      ],
      enabledModels: [
        { provider: 'openai', modelId: 'gpt-4o' },
      ],
    });

    expect(result).toEqual({ ready: true });
  });

  it("no usable key gives ready: false, reason: 'no-credentials'", () => {
    const result = checkGenerationReadiness({
      userConfig: null,
      systemCredentials: [],
    });

    expect(result).toEqual({
      ready: false,
      reason: 'no-credentials',
    });
  });

  it('returns ready: false when system credential exists but does not match enabled models', () => {
    const result = checkGenerationReadiness({
      systemCredentials: [{ provider: 'anthropic' }],
      enabledModels: [{ provider: 'openai', modelId: 'gpt-4o' }],
    });

    expect(result).toEqual({
      ready: false,
      reason: 'no-credentials',
    });
  });

  it('supports Map and Record formats for system credentials', () => {
    const mapResult = checkGenerationReadiness({
      systemCredentials: new Map([['openai', { apiKey: 'secret' }]]),
      enabledModels: [{ provider: 'openai', modelId: 'gpt-4o' }],
    });
    expect(mapResult).toEqual({ ready: true });

    const recordResult = checkGenerationReadiness({
      systemCredentials: { openai: { apiKey: 'secret' } },
      enabledModels: [{ provider: 'openai', modelId: 'gpt-4o' }],
    });
    expect(recordResult).toEqual({ ready: true });
  });

  it('handles Buffer and ArrayBuffer apiKey', () => {
    const bufferResult = checkGenerationReadiness({
      userConfig: { apiKey: new Uint8Array([1, 2, 3]).buffer },
    });
    expect(bufferResult).toEqual({ ready: true });
  });
});
