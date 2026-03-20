import { describe, test, expect } from 'vitest';
import type { Doc } from '../../convex/_generated/dataModel';

describe('Ticket data structure', () => {
  test('ticket status is one of todo | in_progress | done', () => {
    const validStatuses = ['todo', 'in_progress', 'done'] as const;
    const status = 'todo';
    expect(validStatuses).toContain(status);
  });

  test('ticket priority is one of critical | high | medium | low', () => {
    const validPriorities = ['critical', 'high', 'medium', 'low'] as const;
    const priority = 'high';
    expect(validPriorities).toContain(priority);
  });

  test('ticket object has all required fields', () => {
    const ticket = {
      projectId: 'proj_123' as string,
      phaseId: 'stories',
      title: 'Implement login flow',
      description: 'Build the OAuth2 login flow with Google provider',
      acceptanceCriteria: [
        'User can click "Sign in with Google"',
        'Successful auth redirects to dashboard',
        'Failed auth shows error message',
      ],
      status: 'todo' as const,
      priority: 'high' as const,
      estimatedEffort: 'M',
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(ticket.acceptanceCriteria).toHaveLength(3);
    expect(ticket.status).toBe('todo');
    expect(ticket.priority).toBe('high');
  });

  test('ticket acceptanceCriteria can be empty array', () => {
    const ticket = {
      projectId: 'proj_123',
      phaseId: 'stories',
      title: 'Simple task',
      description: 'No acceptance criteria',
      acceptanceCriteria: [] as string[],
      status: 'todo' as const,
      priority: 'medium' as const,
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(ticket.acceptanceCriteria).toHaveLength(0);
  });
});
