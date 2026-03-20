import { describe, test, expect } from 'vitest';
import { parseSectionPlanResponse } from '../section-plan-parser';

describe('parseSectionPlanResponse', () => {
  test('parses valid JSON array of sections', () => {
    const raw = JSON.stringify([
      { id: 's1', title: 'Architecture Overview', description: 'High-level design', estimatedTokens: 800, required: true, sectionType: 'technical' },
      { id: 's2', title: 'API Design', description: 'REST endpoints', estimatedTokens: 600, required: false, sectionType: 'implementation' },
    ]);
    const result = parseSectionPlanResponse(raw);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Architecture Overview');
    expect(result[0].required).toBe(true);
  });

  test('handles JSON wrapped in markdown code fence', () => {
    const raw = '```json\n[{"id":"s1","title":"Intro","description":"Desc","estimatedTokens":500,"required":true}]\n```';
    const result = parseSectionPlanResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Intro');
  });

  test('returns empty array for invalid JSON', () => {
    const result = parseSectionPlanResponse('not json at all');
    expect(result).toHaveLength(0);
  });
});
