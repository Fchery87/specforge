import { describe, expect, it } from 'vitest';
import { getUpstreamPhases } from '../dependency-graph';
import { descriptionForPhase, formatQuestionContext } from '../question-context';

describe('getUpstreamPhases', () => {
  it('follows dependencies through other phases, in workflow order', () => {
    expect(getUpstreamPhases('constitution')).toEqual([]);
    expect(getUpstreamPhases('prd')).toEqual(['constitution', 'brief']);
    expect(getUpstreamPhases('specs')).toEqual(['constitution', 'brief', 'prd', 'domainModel']);
    expect(getUpstreamPhases('handoff')).toEqual([
      'constitution',
      'brief',
      'prd',
      'domainModel',
      'specs',
      'stories',
      'artifacts',
    ]);
  });
});

describe('descriptionForPhase', () => {
  const long = 'x'.repeat(3500);

  it('gives the early phases the whole description', () => {
    expect(descriptionForPhase(long, 'constitution')).toBe(long);
    expect(descriptionForPhase(long, 'brief')).toBe(long);
  });

  it('truncates a long description for later phases and points at the approved documents', () => {
    const result = descriptionForPhase(long, 'specs');
    expect(result.startsWith('x'.repeat(3000))).toBe(true);
    expect(result).toContain('Refer to approved upstream Constitution and Brief');
    expect(descriptionForPhase('short', 'specs')).toBe('short');
  });
});

describe('formatQuestionContext', () => {
  const upstream = [
    {
      phaseId: 'brief',
      questions: [
        { id: 'q_1', text: 'Who is it for?', answer: 'Agencies', answerOrigin: 'user' as const },
        { id: 'q_2', text: 'Unanswered?' },
        { id: 'q_3', text: 'Retention?', answer: 'One year', answerOrigin: 'drafted' as const },
      ],
      claims: [],
    },
    {
      phaseId: 'prd',
      questions: [],
      claims: [
        { claimId: 'REQ-0001', text: 'An editor may archive a project.' },
        { claimId: 'REQ-0002', text: 'x'.repeat(250) },
      ],
    },
  ];

  it('lists constraints, answered upstream questions and upstream requirements', () => {
    expect(
      formatQuestionContext({
        constraints: { architecture: 'Modular monolith', securityProtocols: ['SSO', 'MFA'] },
        upstream,
      }),
    ).toBe(
      [
        '[Constitution Constraints]\nArchitecture: Modular monolith\nSecurity Protocols: SSO, MFA',
        'Q: [brief] Who is it for?\nA: Agencies\n\nQ: [brief] Retention?\nA: One year (assumed by the assistant, not reviewed)',
        `[Approved requirements in prd]\n- REQ-0001 An editor may archive a project.\n- REQ-0002 ${'x'.repeat(200)}…`,
      ].join('\n\n'),
    );
  });

  it('caps a phase at forty requirements and says how many were left out', () => {
    const claims = Array.from({ length: 45 }, (_, i) => ({ claimId: `REQ-${i}`, text: 't' }));
    const text = formatQuestionContext({ upstream: [{ phaseId: 'prd', questions: [], claims }] });
    expect(text.split('\n').filter((line) => line.startsWith('- REQ-'))).toHaveLength(40);
    expect(text).toContain('(5 more not listed)');
  });

  it('is empty when nothing upstream has been decided', () => {
    expect(formatQuestionContext({ upstream: [] })).toBe('');
  });
});
