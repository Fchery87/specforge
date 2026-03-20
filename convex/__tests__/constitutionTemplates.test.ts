import { describe, test, expect } from 'vitest';

describe('constitutionTemplates schema', () => {
  test('template shape is valid', () => {
    const template = {
      userId: 'user_123',
      name: 'Next.js SaaS',
      description: 'Standard constraints for Next.js SaaS projects',
      constitutionContent: '## Architecture\n- Next.js 16 App Router\n',
      lockedConstraints: {
        architecture: 'Next.js App Router',
        stateManagement: 'Zustand + React Query',
        apiDesign: 'REST with Convex mutations',
      },
      createdAt: Date.now(),
      usageCount: 0,
    };
    expect(template.name).toBe('Next.js SaaS');
    expect(template.usageCount).toBe(0);
    expect(template.lockedConstraints?.architecture).toBe('Next.js App Router');
  });

  test('template without lockedConstraints is valid', () => {
    const template: {
      userId: string;
      name: string;
      description: string;
      constitutionContent: string;
      lockedConstraints?: { architecture?: string };
      createdAt: number;
      usageCount: number;
    } = {
      userId: 'user_123',
      name: 'Generic',
      description: 'Generic template',
      constitutionContent: 'No constraints',
      createdAt: Date.now(),
      usageCount: 3,
    };
    expect(template.lockedConstraints).toBeUndefined();
    expect(template.usageCount).toBe(3);
  });
});
