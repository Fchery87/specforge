import { describe, test, expect } from 'vitest';
import { buildTemplateInsert } from '../constitutionTemplates';

describe('buildTemplateInsert', () => {
  test('sets usageCount to 0 and includes createdAt', () => {
    const before = Date.now();
    const result = buildTemplateInsert('user_123', 'Next.js SaaS', 'desc', '## Architecture\n');
    const after = Date.now();
    expect(result.usageCount).toBe(0);
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
    expect(result.userId).toBe('user_123');
    expect(result.name).toBe('Next.js SaaS');
  });

  test('includes lockedConstraints when provided', () => {
    const constraints = { architecture: 'Serverless', stateManagement: 'Zustand' };
    const result = buildTemplateInsert('user_123', 'Template', 'desc', 'content', constraints);
    expect(result.lockedConstraints?.architecture).toBe('Serverless');
    expect(result.lockedConstraints?.stateManagement).toBe('Zustand');
  });

  test('lockedConstraints is undefined when not provided', () => {
    const result = buildTemplateInsert('user_123', 'T', 'd', 'c');
    expect(result.lockedConstraints).toBeUndefined();
  });
});
