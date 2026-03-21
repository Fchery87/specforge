// lib/__tests__/oauth-state.test.ts
import { describe, expect, it } from 'vitest';

// Allowlist of valid redirect patterns
const ALLOWED_REDIRECT_PATTERNS = [
  /^\/project\/[a-zA-Z0-9_-]+$/,
  /^\/dashboard$/,
];

function isValidRedirect(redirect: string): boolean {
  return ALLOWED_REDIRECT_PATTERNS.some((pattern) => pattern.test(redirect));
}

function generateNonce(): string {
  // 16 random bytes as hex
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('OAuth state security', () => {
  it('rejects external URLs as redirect', () => {
    expect(isValidRedirect('https://evil.com')).toBe(false);
    expect(isValidRedirect('//evil.com')).toBe(false);
    expect(isValidRedirect('javascript:alert(1)')).toBe(false);
  });

  it('accepts valid project redirects', () => {
    expect(isValidRedirect('/project/abc123')).toBe(true);
    expect(isValidRedirect('/dashboard')).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(isValidRedirect('/project/../admin')).toBe(false);
  });

  it('generates a nonce of sufficient length', () => {
    const nonce = generateNonce();
    expect(nonce.length).toBe(32); // 16 bytes = 32 hex chars
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
  });
});
