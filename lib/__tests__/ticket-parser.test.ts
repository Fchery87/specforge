import { describe, test, expect } from 'vitest';
import { parseTicketsFromMarkdown } from '../ticket-parser';

describe('parseTicketsFromMarkdown', () => {
  test('extracts tickets from user stories markdown', () => {
    const markdown = `
## Epic: Authentication
### US-001: User Login
As a user, I want to log in with my email so that I can access my account.

**Acceptance Criteria:**
- User can enter email and password
- Valid credentials redirect to dashboard
- Invalid credentials show error message

**Priority:** High
**Effort:** M

### US-002: Password Reset
As a user, I want to reset my password so that I can regain access.

**Acceptance Criteria:**
- User can request password reset via email
- Reset link expires after 24 hours

**Priority:** Medium
**Effort:** S
`;
    const tickets = parseTicketsFromMarkdown(markdown);
    expect(tickets).toHaveLength(2);
    expect(tickets[0].title).toBe('US-001: User Login');
    expect(tickets[0].acceptanceCriteria).toHaveLength(3);
    expect(tickets[0].priority).toBe('high');
    expect(tickets[0].estimatedEffort).toBe('M');
    expect(tickets[1].title).toBe('US-002: Password Reset');
    expect(tickets[1].acceptanceCriteria).toHaveLength(2);
  });

  test('handles markdown without structured tickets', () => {
    const markdown = '# User Stories\n\nSome general text about user stories.';
    const tickets = parseTicketsFromMarkdown(markdown);
    expect(tickets).toHaveLength(0);
  });
});
