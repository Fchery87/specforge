import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TicketCard } from '../ticket-card';

describe('TicketCard', () => {
  const ticket = {
    _id: 't1' as any,
    title: 'Implement login',
    description: 'Build OAuth login flow',
    acceptanceCriteria: ['Can enter email', 'Redirect on success'],
    status: 'todo' as const,
    priority: 'high' as const,
    estimatedEffort: 'M',
    order: 0,
  };

  test('renders ticket title and priority', () => {
    render(<TicketCard ticket={ticket} onStatusChange={() => {}} />);
    expect(screen.getByText('Implement login')).toBeDefined();
    expect(screen.getByText('high')).toBeDefined();
  });

  test('shows acceptance criteria count', () => {
    render(<TicketCard ticket={ticket} onStatusChange={() => {}} />);
    expect(screen.getByText('2 criteria')).toBeDefined();
  });
});
