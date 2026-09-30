import type { PhaseQuestion } from '../question-model';

/** A stored phase question with the required fields filled in, for tests that care about a few. */
export function phaseQuestion(fields: Partial<PhaseQuestion> & Pick<PhaseQuestion, 'id' | 'text'>): PhaseQuestion {
  return { required: false, source: 'phase', feeds: [], ...fields };
}
