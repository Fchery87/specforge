import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Id } from '@/convex/_generated/dataModel';
import { TicketCard } from '../ticket-card';

describe('TicketCard', () => {
  const ticket = {
    _id: 't1' as unknown as Id<'tickets'>,
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

  test('clicking button on todo ticket calls onStatusChange with in_progress', () => {
    const onStatusChange = vi.fn();
    render(<TicketCard ticket={{ ...ticket, status: 'todo' }} onStatusChange={onStatusChange} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onStatusChange).toHaveBeenCalledWith(ticket._id, 'in_progress');
  });

  test('clicking button on in_progress ticket calls onStatusChange with done', () => {
    const onStatusChange = vi.fn();
    render(<TicketCard ticket={{ ...ticket, status: 'in_progress' }} onStatusChange={onStatusChange} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onStatusChange).toHaveBeenCalledWith(ticket._id, 'done');
  });

  test('clicking button on done ticket calls onStatusChange with todo', () => {
    const onStatusChange = vi.fn();
    render(<TicketCard ticket={{ ...ticket, status: 'done' }} onStatusChange={onStatusChange} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onStatusChange).toHaveBeenCalledWith(ticket._id, 'todo');
  });
});
