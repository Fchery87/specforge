import { describe, expect, it } from 'vitest';
import {
  classifyCriteria,
  classifyCriterion,
  criterionClasses,
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

/**
 * Cases a review found by attacking this module with adversarial input. Each one was reproduced
 * against the shipped version before it was fixed, so these are the regression lock for the classes
 * of mistake the original corpus missed. Most were false `observable`, the direction that lets a
 * criterion pass with nothing to check.
 */
describe('classifyCriterion regressions found in review', () => {
  it('does not read a possibility modal as a permission', () => {
    // `may` and `can` express possibility as well as permission, and the first version excluded only
    // the copula `be`, so any other linking verb let a bare quality claim through.
    expect(classifyCriterion('The system may feel unresponsive.')).toBe('unobservable');
    expect(classifyCriterion('The button can feel sluggish.')).toBe('unobservable');
    expect(classifyCriterion('The report can look confusing.')).toBe('unobservable');
    expect(classifyCriterion('The cache can stay warm.')).toBe('unobservable');
  });

  it('does not treat a noun that is spelled like a verb as an effect', () => {
    // The largest source of false observables: report, record, log, display and set are all in the
    // result-verb list, so any criterion mentioning the noun read as observable.
    expect(classifyCriterion('The report should be clear.')).toBe('unobservable');
    expect(classifyCriterion('The user record must be accurate.')).toBe('unobservable');
    expect(classifyCriterion('The display should be readable.')).toBe('unobservable');
    expect(classifyCriterion('The log should be useful.')).toBe('unobservable');
    expect(classifyCriterion('The set of fields is complete.')).toBe('unobservable');
  });

  it('still reads the same words as verbs in verb positions', () => {
    expect(classifyCriterion('The report returns 200.')).toBe('observable');
    expect(classifyCriterion('A report is written for each run.')).toBe('observable');
    expect(classifyCriterion('The service records one event per archive.')).toBe('observable');
    expect(classifyCriterion('Report the total.')).toBe('observable');
  });

  it('gives an inflected generic verb the same class as its base form', () => {
    // The same criterion used to change class by adding a tense.
    for (const base of ['Handle edge cases.', 'Support the feature.', 'Improve things.', 'Add validation.']) {
      expect(classifyCriterion(base)).toBe('vague');
    }
    expect(classifyCriterion('Handling edge cases.')).toBe('vague');
    expect(classifyCriterion('Supporting the feature.')).toBe('vague');
    expect(classifyCriterion('Improving things.')).toBe('vague');
    expect(classifyCriterion('Improved things.')).toBe('vague');
    expect(classifyCriterion('Adding validation.')).toBe('vague');
  });

  it('does not stem a plural noun onto a quality adjective', () => {
    // `goods` stripped to `good`, which demoted a real effect and lost its result verb.
    expect(classifyCriterion('The warehouse stores goods.')).toBe('observable');
  });

  it('does not stem a degree adverb onto a quality adjective', () => {
    // `greatly` stems to `great`, which suppressed a genuine result verb.
    expect(classifyCriterion('greatly returns.')).toBe('observable');
  });

  it('keeps the quality-word rule ahead of the effect rule for unlisted adjectives', () => {
    expect(classifyCriterion('The system renders a pleasant experience.')).toBe('unobservable');
    expect(classifyCriterion('The app returns a professional look.')).toBe('unobservable');
    expect(classifyCriterion('The UI renders an attractive layout.')).toBe('unobservable');
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

/**
 * Reading a ticket's stored classes. A ticket written before the field existed has none, and the rule
 * is that its criteria read as `unclassified` rather than being labelled retroactively: classifying
 * one later would report a judgement nobody made when the ticket was reviewed.
 */
describe('criterionClasses', () => {
  const criteria = ['Returns 204.', 'Fast.', 'Handle edge cases.'];

  it('reads each stored class back in order', () => {
    expect(criterionClasses(criteria, ['observable', 'unobservable', 'vague'])).toEqual([
      'observable',
      'unobservable',
      'vague',
    ]);
  });

  it('reads a ticket with no stored classes as all unclassified', () => {
    expect(criterionClasses(criteria)).toEqual([
      'unclassified',
      'unclassified',
      'unclassified',
    ]);
    expect(criterionClasses(criteria, null)).toEqual([
      'unclassified',
      'unclassified',
      'unclassified',
    ]);
    expect(criterionClasses(criteria, [])).toEqual([
      'unclassified',
      'unclassified',
      'unclassified',
    ]);
  });

  it('always returns one entry per criterion, so the arrays stay index-aligned', () => {
    // A short stored array must not shift the entries: a criterion with no stored class is
    // unclassified, not the next criterion's class.
    expect(criterionClasses(criteria, ['observable'])).toEqual([
      'observable',
      'unclassified',
      'unclassified',
    ]);

    // A long one is truncated to the criteria, not appended.
    expect(
      criterionClasses(criteria, ['observable', 'vague', 'unobservable', 'vague'])
    ).toHaveLength(criteria.length);

    expect(criterionClasses([], ['observable'])).toEqual([]);
  });

  it('treats a stored value it does not recognise as unclassified', () => {
    // The field is persisted data. Anything that did not come from classifyCriterion is not a class,
    // whatever it says, so it must not reach a reader as a verdict.
    expect(criterionClasses(['a', 'b'], ['observable', 'excellent'])).toEqual([
      'observable',
      'unclassified',
    ]);
    expect(criterionClasses(['a'], [''])).toEqual(['unclassified']);
    expect(criterionClasses(['a'], ['OBSERVABLE'])).toEqual(['unclassified']);
  });

  it('round-trips what the parser stores', () => {
    const stored = classifyCriteria(criteria);
    expect(criterionClasses(criteria, stored)).toEqual(stored);
  });
});
