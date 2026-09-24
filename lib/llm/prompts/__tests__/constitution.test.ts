import { describe, expect, it } from 'vitest';
import {
  CONSTITUTION_PROMPT,
  formatConstitutionTemplateGuidance,
  injectConstitutionContext,
} from '../constitution';

describe('constitution prompt guidance', () => {
  it('formats a selected template as reference material with constraints', () => {
    const guidance = formatConstitutionTemplateGuidance({
      name: 'Web application',
      constitutionContent: 'Use accessible controls.',
      lockedConstraints: { architecture: 'Modular monolith' },
    });

    expect(guidance).toContain('user-provided reference material');
    expect(guidance).toContain('include them as confirmed constraints');
    expect(guidance).toContain('Use accessible controls.');
    expect(guidance).toContain('Modular monolith');
  });

  it('leaves a missing template empty', () => {
    expect(formatConstitutionTemplateGuidance()).toBe('');
  });

  it('anchors applicable web standards to verified versions and a dated review', () => {
    expect(CONSTITUTION_PROMPT).toContain('WCAG 2.2 Level AA');
    expect(CONSTITUTION_PROMPT).toContain('ASVS) 5.0.0');
    expect(CONSTITUTION_PROMPT).toContain('2026-09-22');
    expect(CONSTITUTION_PROMPT).toContain('do not claim compliance without verification');
  });

  it('makes downstream artifacts honor confirmed facts without freezing proposals', () => {
    const prompt = injectConstitutionContext(
      'Generate the artifact.',
      'Confirmed: use Clerk. Proposed: add audit logging.',
    );

    expect(prompt).toContain('confirmed constraints as binding');
    expect(prompt).toContain('Proposed: add audit logging.');
    expect(prompt).not.toContain('ALL decisions in your response MUST align');
  });
});
