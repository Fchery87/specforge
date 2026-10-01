"use client";

import { QuestionRow } from "@/components/question-row";
import { feedsLabel } from "@/lib/specification/question-model";

const PHASE = "specs";

const ROWS = [
  {
    id: "q_typed",
    text: "How should Ledger authenticate users and bind an invitation to the invited email?",
    answer: "Clerk sessions. An invitation stores the invited email, and accepting it requires a signed-in user whose verified email matches.",
    feeds: ["deployment-and-security", "data-models-and-api"],
    assumed: false,
    modelWritten: false,
    required: true,
  },
  {
    id: "q_assumed",
    text: "How should settlements be modeled and applied against outstanding balances?",
    answer: "A settlement is a ledger entry between two members. It cannot exceed the outstanding balance, and balances are always derived from entries.",
    feeds: ["data-models-and-api", "deep-modules"],
    assumed: true,
    modelWritten: true,
    required: true,
  },
  {
    id: "q_whole",
    text: "Are there constraints that apply to the whole document?",
    answer: "",
    feeds: [] as string[],
    assumed: false,
    modelWritten: false,
    required: false,
  },
];

/**
 * The questions as the phase page shows them: what each feeds, and an answer the assistant wrote and
 * nobody has reviewed marked as assumed. Static props, so it needs no deployment.
 */
export function QuestionPreviews() {
  return (
    <div className="space-y-8 rounded-lg border border-line bg-surface p-5 md:p-8">
      {ROWS.map((row, index) => (
        <QuestionRow
          key={row.id}
          question={{ id: row.id, text: row.text, required: row.required }}
          index={index}
          answer={row.answer}
          isSaving={false}
          isSaved={false}
          isAiGenerating={false}
          modelWritten={row.modelWritten}
          suggestions={[]}
          feedsLabel={feedsLabel(PHASE, row.feeds)}
          assumed={row.assumed}
          isPhaseGenerating={false}
          maxLength={2000}
          onAnswerChange={() => undefined}
          onAiSuggest={() => undefined}
          onSuggestionSelect={() => undefined}
          onKeepAssumed={() => undefined}
        />
      ))}
    </div>
  );
}
