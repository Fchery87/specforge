import { describe, expect, it } from 'vitest';
import { PHASE_ORDER } from '../../workflow';
import {
  PHASE_SECTIONS,
  sectionIdsFor,
  sectionInstructionsFor,
  sectionsFor,
} from '../phase-sections';

describe('PHASE_SECTIONS', () => {
  it('lists the sections each phase generates, in order', () => {
    expect(sectionIdsFor('constitution')).toEqual([
      'locked-constraints',
      'architecture-decisions',
      'tech-stack',
      'quality-and-standards',
    ]);
    expect(sectionIdsFor('brief')).toEqual([
      'executive-summary',
      'problem-and-objectives',
      'features-and-requirements',
    ]);
    expect(sectionIdsFor('prd')).toEqual(['executive-summary', 'requirements', 'success-metrics']);
    expect(sectionIdsFor('domainModel')).toEqual([
      'domain-glossary',
      'entity-definitions',
      'entity-relationships',
      'state-transitions',
    ]);
    expect(sectionIdsFor('specs')).toEqual([
      'architecture-overview',
      'deep-modules',
      'test-seams',
      'data-models-and-api',
      'deployment-and-security',
    ]);
    expect(sectionIdsFor('stories')).toEqual(['epic-overview', 'user-stories', 'technical-tasks']);
    expect(sectionIdsFor('artifacts')).toEqual(['documentation', 'configuration', 'deployment-guide']);
    expect(sectionIdsFor('handoff')).toEqual(['project-summary', 'setup-guide', 'next-steps']);
  });

  it('defines every workflow phase', () => {
    expect(Object.keys(PHASE_SECTIONS).sort()).toEqual([...PHASE_ORDER].sort());
  });

  it('gives every section a title, description, instructions and its own phase', () => {
    for (const phaseId of PHASE_ORDER) {
      const ids = new Set<string>();
      for (const section of PHASE_SECTIONS[phaseId]) {
        expect(section.title.trim(), `${phaseId}/${section.id} title`).not.toBe('');
        expect(section.description.trim(), `${phaseId}/${section.id} description`).not.toBe('');
        expect(section.instructions.trim(), `${phaseId}/${section.id} instructions`).not.toBe('');
        expect(section.estimatedTokens).toBeGreaterThan(0);
        expect(section.phaseId).toBe(phaseId);
        expect(ids.has(section.id), `${phaseId}/${section.id} duplicated`).toBe(false);
        ids.add(section.id);
      }
    }
  });
});

describe('lookups', () => {
  it('returns no sections for an id that is not a phase', () => {
    expect(sectionsFor('nope')).toEqual([]);
    expect(sectionIdsFor('nope')).toEqual([]);
  });

  it('returns a section instruction, and a generic one for an unknown section', () => {
    expect(sectionInstructionsFor('brief', 'problem-and-objectives')).toMatch(/problem this project solves/);
    expect(sectionInstructionsFor('specs', 'test-seams-part-2')).toBe(sectionInstructionsFor('specs', 'test-seams'));
    expect(sectionInstructionsFor('brief', 'made-up')).toBe(
      'Generate comprehensive content for the made-up section.',
    );
  });
});
