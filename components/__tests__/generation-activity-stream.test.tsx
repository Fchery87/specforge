import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationActivityStream } from '../generation-activity-stream';

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const activities = [
  { timestamp: 1000, message: 'Gathering context...', type: 'context' as const },
  { timestamp: 2000, message: 'Generating "Architecture"...', type: 'generating' as const },
];

describe('GenerationActivityStream', () => {
  test('renders nothing when activities are empty', () => {
    const { container } = render(
      <GenerationActivityStream activities={[]} isActive={false} />
    );
    expect(container.children).toHaveLength(0);
  });

  test('renders activity messages', () => {
    render(<GenerationActivityStream activities={activities} isActive={true} />);
    expect(screen.getByText('Gathering context...')).toBeDefined();
    expect(screen.getByText('Generating "Architecture"...')).toBeDefined();
  });

  test('renders "Generation Activity" heading', () => {
    render(<GenerationActivityStream activities={activities} isActive={false} />);
    expect(screen.getByText(/Generation Activity/i)).toBeDefined();
  });
});
