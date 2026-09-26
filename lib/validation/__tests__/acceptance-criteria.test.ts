import { describe, expect, it } from 'vitest';
import {
  classifyCriteria,
  classifyCriterion,
  type AcceptanceCriterionClass,
} from '../acceptance-criteria';

/**
 * The corpus is the regression lock. Every entry was classified by hand and the expectation written
 * down, so a change to the rules that moves a case has to be argued for here rather than noticed in
 * production. Add a case whenever a real criterion is misclassified.
 */
const CORPUS: Array<[string, AcceptanceCriterionClass]> = [
  // -- observable: names a result a check can confirm --------------------------------------------
  ['Archiving a project sets its status to archived.', 'observable'],
  ['The archive endpoint returns 204 for an editor and 403 for a viewer.', 'observable'],
  ['The API responds within 200ms for 95% of requests.', 'observable'],
  ['Given an expired token, the request fails with 401.', 'observable'],
  ['A member with the editor role may archive a project.', 'observable'],
  ['The importer writes one audit record per archived project.', 'observable'],
  ['Deleting a project removes its artifacts.', 'observable'],
  ['The list endpoint returns at most 50 items.', 'observable'],
  ['The worker throws when the payload exceeds 1MB.', 'observable'],
  ['An archived project rejects a new generation run.', 'observable'],
  ['Audit events are retained for one year.', 'observable'],
  ['The build passes.', 'observable'],

  // -- unobservable: asserts something, but nothing checks it ------------------------------------
  ['Archiving should be fast.', 'unobservable'],
  ['The UI should be intuitive and responsive.', 'unobservable'],
  ['The system must be scalable.', 'unobservable'],
  ['Code should be clean and maintainable.', 'unobservable'],
  ['The API should be secure.', 'unobservable'],
  ['The feature should be robust.', 'unobservable'],
  ['Works correctly.', 'unobservable'],
  ['User authentication is required.', 'unobservable'],
  ['The cache must be reliable under load.', 'unobservable'],
  ['Password hashing uses argon2id.', 'unobservable'],
  // Regression: a probe of the first draft read the bare verb `responds` and passed this. A quality
  // word has to outrank a named effect, or every "returns quickly" slips through as observable.
  ['Responds quickly.', 'unobservable'],
  ['The endpoint returns results quickly.', 'unobservable'],
  ['Deleting a project removes it cleanly.', 'unobservable'],

  // -- vague: names no subject and no outcome ----------------------------------------------------
  ['Handle edge cases.', 'vague'],
  ['Support the feature.', 'vague'],
  ['Improve things.', 'vague'],
  ['Add validation.', 'vague'],
  ['Manage the flow.', 'vague'],
  ['Address edge cases and errors.', 'vague'],
  ['TBD', 'vague'],
  ['', 'vague'],
];

describe('classifyCriterion corpus', () => {
  // A loop rather than `it.each` so each case gets its own named test and the typing stays plain.
  for (const [criterion, expected] of CORPUS) {
    it(`classifies ${JSON.stringify(criterion)} as ${expected}`, () => {
      expect(classifyCriterion(criterion)).toBe(expected);
    });
  }
});

describe('classifyCriterion rule order', () => {
  it('prefers a stated threshold over a quality word in the same criterion', () => {
    // "responsive" alone would be unobservable; the bound makes it checkable.
    expect(
      classifyCriterion('The endpoint stays responsive, returning within 200ms.')
    ).toBe('observable');
  });

  it('prefers a quality word over a bare named effect', () => {
    // The regression the probe caught. A verb on its own states no measurement.
    expect(classifyCriterion('The endpoint responds quickly.')).toBe('unobservable');
    expect(classifyCriterion('The endpoint responds with 204.')).toBe('observable');
  });

  it('does not read "may be <quality>" as a permission', () => {
    // A permission needs a named action. "may be scalable" asserts a quality.
    expect(classifyCriterion('The system may be scalable.')).toBe('unobservable');
  });

  it('reads a permission with a named action as observable', () => {
    expect(classifyCriterion('A viewer may not archive a project.')).toBe('observable');
  });

  it('defaults to unobservable rather than vague when a specific subject is named', () => {
    // It asserts something about a real subject; the reader just has no check for it. Vague is
    // reserved for a criterion that names nothing at all.
    expect(classifyCriterion('Password hashing uses argon2id.')).toBe('unobservable');
    expect(classifyCriterion('The retry budget is three attempts.')).toBe('unobservable');
  });
});

describe('classifyCriterion normalisation', () => {
  it('ignores markdown emphasis and code spans', () => {
    expect(classifyCriterion('**Returns** `204`.')).toBe('observable');
  });

  it('ignores a leftover list marker and extra whitespace', () => {
    expect(classifyCriterion('  1. Returns   204  ')).toBe('observable');
    expect(classifyCriterion('-   Handle   edge cases.')).toBe('vague');
  });

  it('treats a whitespace-only criterion as vague', () => {
    expect(classifyCriterion('   \n\t ')).toBe('vague');
  });
});

describe('classifyCriterion determinism', () => {
  it('returns the same class for the same input every time', () => {
    const criterion = 'The archive endpoint returns 204 for an editor and 403 for a viewer.';
    const first = classifyCriterion(criterion);
    const second = classifyCriterion(criterion);
    const third = classifyCriterion(criterion);

    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});

describe('classifyCriteria', () => {
  it('classifies a list in order, so an index lines up with the input', () => {
    const criteria = [
      'The archive endpoint returns 204.',
      'Archiving should be fast.',
      'Handle edge cases.',
    ];

    expect(classifyCriteria(criteria)).toEqual([
      'observable',
      'unobservable',
      'vague',
    ]);
  });

  it('returns an empty list for no criteria', () => {
    expect(classifyCriteria([])).toEqual([]);
  });
});
