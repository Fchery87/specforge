import { describe, expect, it } from 'vitest';
import { parseJsonReply } from '../json-reply';

describe('parseJsonReply', () => {
  it('takes the object out of prose and a code fence', () => {
    expect(parseJsonReply('Here it is:\n```json\n{"verdicts": []}\n```\nDone.', 'check')).toEqual({ verdicts: [] });
  });

  it('repairs a quoted regex whose backslashes were not doubled', () => {
    const reply = String.raw`{"quote": "const PREFIX = /^\*\*(?<id>[A-Z]+-\d+)\*\*\s*/;", "path": "lib/evidence.ts"}`;
    expect(parseJsonReply(reply, 'check')).toEqual({ quote: String.raw`const PREFIX = /^\*\*(?<id>[A-Z]+-\d+)\*\*\s*/;`, path: 'lib/evidence.ts' });
  });

  it('keeps a regex word boundary as written when the reply needed repair', () => {
    const reply = String.raw`{"quote": "const OBLIGATION = /\b(must|shall)\b\s*/i;"}`;
    expect(parseJsonReply(reply, 'check')).toEqual({ quote: String.raw`const OBLIGATION = /\b(must|shall)\b\s*/i;` });
  });

  it('leaves valid escapes alone', () => {
    expect(parseJsonReply(String.raw`{"text": "line one\nline \"two\" \\ end"}`, 'check')).toEqual({ text: 'line one\nline "two" \\ end' });
  });

  it('names the reply when there is no object, or it cannot be repaired', () => {
    expect(() => parseJsonReply('I could not do this.', 'check')).toThrow('The check reply held no JSON object');
    expect(() => parseJsonReply('{ verdicts: [ }', 'draft')).toThrow('The draft reply was not valid JSON');
  });
});
