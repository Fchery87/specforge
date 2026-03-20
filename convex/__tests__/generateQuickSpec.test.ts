import { describe, test, expect } from 'vitest';
import { buildQuickSpecPrompt } from '../actions/generateQuickSpec';

describe('Quick Spec prompt', () => {
  test('prompt includes all required sections', () => {
    const prompt = buildQuickSpecPrompt('Add OAuth login', 'Using Google OAuth with NextAuth');
    expect(prompt).toContain('Architecture Decisions');
    expect(prompt).toContain('Implementation Steps');
    expect(prompt).toContain('Technical Considerations');
    expect(prompt).toContain('mermaid');
    expect(prompt).toContain('Add OAuth login');
    expect(prompt).toContain('Using Google OAuth with NextAuth');
  });
});
