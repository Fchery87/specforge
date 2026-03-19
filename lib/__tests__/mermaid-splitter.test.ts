import { describe, test, expect } from 'vitest';
import { splitContentByMermaid } from '../mermaid-splitter';

describe('splitContentByMermaid', () => {
  test('returns single html segment when no mermaid fences', () => {
    const result = splitContentByMermaid('# Hello\n\nSome text.');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('html');
    expect(result[0].content).toContain('Hello');
  });

  test('extracts single mermaid block surrounded by text', () => {
    const md = 'Before\n\n```mermaid\ngraph TD; A-->B\n```\n\nAfter';
    const result = splitContentByMermaid(md);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('html');
    expect(result[1].type).toBe('mermaid');
    expect(result[1].content).toBe('graph TD; A-->B');
    expect(result[2].type).toBe('html');
  });

  test('handles multiple mermaid blocks', () => {
    const md = '```mermaid\ngraph TD; A-->B\n```\n\nSome text\n\n```mermaid\nsequenceDiagram\n```';
    const result = splitContentByMermaid(md);
    const mermaidBlocks = result.filter(s => s.type === 'mermaid');
    expect(mermaidBlocks).toHaveLength(2);
    expect(mermaidBlocks[0].content).toBe('graph TD; A-->B');
    expect(mermaidBlocks[1].content).toBe('sequenceDiagram');
  });

  test('returns empty array for empty string', () => {
    const result = splitContentByMermaid('');
    expect(result).toHaveLength(0);
  });

  test('handles mermaid-only content', () => {
    const md = '```mermaid\ngraph LR; A-->B\n```';
    const result = splitContentByMermaid(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('mermaid');
    expect(result[0].content).toBe('graph LR; A-->B');
  });

  test('ignores non-mermaid code fences', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const result = splitContentByMermaid(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('html');
  });
});
