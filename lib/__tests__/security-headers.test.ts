import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('security headers', () => {
  it('adds a CSP header in next config', () => {
    const content = fs.readFileSync('next.config.js', 'utf8');
    expect(content).toContain('Content-Security-Policy');
  });

  it('allows Clerk and Google Fonts in CSP', () => {
    const content = fs.readFileSync('next.config.js', 'utf8');
    expect(content).toContain('clerk.accounts.dev');
    expect(content).toContain('clerk.com');
    expect(content).toContain('fonts.googleapis.com');
    expect(content).toContain('fonts.gstatic.com');
  });

  it('has worker-src for Clerk', () => {
    const content = fs.readFileSync('next.config.js', 'utf8');
    expect(content).toContain('worker-src');
    expect(content).toContain('blob:');
  });

  it('allows unsafe-eval for Next.js development', () => {
    const content = fs.readFileSync('next.config.js', 'utf8');
    expect(content).toContain('unsafe-eval');
  });

  it('allows Cloudflare challenges for Clerk bot protection', () => {
    const content = fs.readFileSync('next.config.js', 'utf8');
    expect(content).toContain('challenges.cloudflare.com');
  });
});
