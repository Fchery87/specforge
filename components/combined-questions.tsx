"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WORKFLOW_STAGES } from "@/lib/workflow";
import { ConnectModelNote } from "@/components/generation-readiness-banner";
import { feedsLabel, type AnswerOrigin } from "@/lib/specification/question-model";

export interface QuestionData {
  id: string;
  text: string;
  answer?: string;
  required?: boolean;
  suggestions?: string[];
  feeds?: string[];
  answerOrigin?: AnswerOrigin;
}

export interface PhaseQuestionsData {
  phaseId: string;
  status?: string;
  questions?: QuestionData[];
}

export const COMBINED_PHASE_LABELS: Record<string, string> = {
  brief: "Brief",
  prd: "PRD",
  domainModel: "Domain Model",
  specs: "Architecture",
  artifacts: "Schemas",
  stories: "Tasks",
  constitution: "Project Rules",
};

export interface CombinedAnswerItem {
  phaseId: string;
  questionId: string;
  answer: string;
  answerOrigin: AnswerOrigin;
}

export interface CombinedQuestionsProps {
  projectId: string;
  phases: PhaseQuestionsData[];
  skippedPhases?: readonly string[];
  isGenerating?: boolean;
  onGenerateEverything?: (answers: CombinedAnswerItem[]) => Promise<void> | void;
  onRequestSuggestions?: (phaseId: string) => Promise<void> | void;
  modelReady?: boolean;
  className?: string;
}

// Stable, because the answers effect depends on it; a fresh `[]` per render re-runs it forever.
const NO_SKIPPED_PHASES: readonly string[] = [];

export function CombinedQuestions({
  projectId,
  phases,
  skippedPhases = NO_SKIPPED_PHASES,
  isGenerating = false,
  onGenerateEverything,
  onRequestSuggestions,
  modelReady = true,
  className,
}: CombinedQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Who wrote each answer. A suggestion the page pre-fills is `drafted` until the user keeps or edits it.
  const [origins, setOrigins] = useState<Record<string, AnswerOrigin>>({});

  // Initialize answers and suggestions from phase questions
  useEffect(() => {
    const initialAnswers: Record<string, string> = {};
    const initialOrigins: Record<string, AnswerOrigin> = {};

    phases.forEach((phase) => {
      if (skippedPhases.includes(phase.phaseId)) return;

      phase.questions?.forEach((q) => {
        if (q.answer !== undefined && q.answer !== "") {
          initialAnswers[q.id] = q.answer;
          initialOrigins[q.id] = q.answerOrigin ?? "user";
        } else if (q.suggestions && q.suggestions.length > 0) {
          // Pre-fill first suggestion if no answer exists
          initialAnswers[q.id] = q.suggestions[0];
          initialOrigins[q.id] = "drafted";
        } else {
          initialAnswers[q.id] = "";
          initialOrigins[q.id] = "user";
        }
      });
    });

    setAnswers((prev) => ({ ...initialAnswers, ...prev }));
    setOrigins((prev) => ({ ...initialOrigins, ...prev }));
  }, [phases, skippedPhases]);

  function handleAnswerChange(questionId: string, val: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    setOrigins((prev) => ({ ...prev, [questionId]: "user" }));
  }

  function handleKeepAssumed(questionId: string) {
    setOrigins((prev) => ({ ...prev, [questionId]: "accepted" }));
  }

  // Calculate if any required question in enabled phases is empty
  const allEnabledQuestions: Array<{ phaseId: string; question: QuestionData }> = [];
  WORKFLOW_STAGES.forEach((stage) => {
    stage.phaseIds.forEach((phaseId) => {
      if (skippedPhases.includes(phaseId)) return;
      const phaseData = phases.find((p) => p.phaseId === phaseId);
      phaseData?.questions?.forEach((q) => {
        allEnabledQuestions.push({ phaseId, question: q });
      });
    });
  });

  const hasEmptyRequired = allEnabledQuestions.some(
    ({ question }) =>
      question.required && (!answers[question.id] || answers[question.id].trim().length === 0)
  );

  const canGenerate = modelReady && !hasEmptyRequired && !isGenerating;

  async function handleSubmit() {
    if (!canGenerate || !onGenerateEverything) return;
    const items: CombinedAnswerItem[] = allEnabledQuestions.map(({ phaseId, question }) => ({
      phaseId,
      questionId: question.id,
      answer: answers[question.id] ?? "",
      answerOrigin: origins[question.id] ?? "user",
    }));
    await onGenerateEverything(items);
  }

  return (
    <div className={className}>
      <div className="space-y-8">
        {WORKFLOW_STAGES.map((stage) => {
          const enabledPhasesInStage = stage.phaseIds.filter(
            (p) => !skippedPhases.includes(p)
          );

          // Get questions for these enabled phases
          const stagePhasesWithQuestions = enabledPhasesInStage
            .map((phaseId) => ({
              phaseId,
              phaseLabel: COMBINED_PHASE_LABELS[phaseId] ?? phaseId,
              questions: phases.find((p) => p.phaseId === phaseId)?.questions ?? [],
            }))
            .filter((p) => p.questions.length > 0);

          if (stagePhasesWithQuestions.length === 0) return null;

          return (
            <Card key={stage.id} className="border">
              <CardHeader className="p-6 pb-4 border-b border-line/40">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-title font-semibold">
                      {stage.label}
                    </h2>
                    <CardDescription className="text-ui text-muted-foreground mt-1">
                      {stage.summary}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {stagePhasesWithQuestions.map(({ phaseId, phaseLabel, questions }) => (
                  <div key={phaseId} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-ui font-semibold text-muted-foreground">
                        {phaseLabel}
                      </h3>
                      {onRequestSuggestions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestSuggestions(phaseId)}
                          className="h-7 text-caption text-muted-foreground hover:text-ink"
                        >
                          <Sparkles className="size-3 mr-1 text-primary" />
                          Refresh suggestions
                        </Button>
                      )}
                    </div>
                    <div className="space-y-6">
                      {questions.map((q, idx) => {
                        const currentAnswer = answers[q.id] ?? "";
                        const assumed = (origins[q.id] ?? "user") === "drafted";

                        return (
                          <div key={q.id} className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <label
                                htmlFor={`q-${q.id}`}
                                className="text-ui font-medium leading-relaxed"
                              >
                                <span className="text-muted-foreground font-mono mr-2">
                                  {String(idx + 1).padStart(2, "0")}.
                                </span>
                                {q.text}
                                {q.required && (
                                  <span className="text-destructive ml-1">*</span>
                                )}
                                <span className="block text-caption font-normal text-muted-foreground mt-0.5">
                                  {feedsLabel(phaseId, q.feeds)}
                                </span>
                              </label>
                              {assumed && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant="outline"
                                    className="bg-warning/10 text-warning border-warning/30"
                                  >
                                    Assumed
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleKeepAssumed(q.id)}
                                    className="h-6 px-2 text-caption"
                                  >
                                    <Check className="size-3 mr-1" />
                                    Keep
                                  </Button>
                                </div>
                              )}
                            </div>
                            <Textarea
                              id={`q-${q.id}`}
                              value={currentAnswer}
                              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                              placeholder={
                                q.required ? "Required answer..." : "Optional answer..."
                              }
                              rows={3}
                              className="w-full text-ui resize-y"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* Generate all phases bar */}
        <div className="sticky bottom-6 z-20 p-4 bg-void/95 border border-line rounded-lg flex items-center justify-between gap-4">
          <div className="text-ui text-muted-foreground">
            {!modelReady
              ? <ConnectModelNote />
              : hasEmptyRequired
              ? "Answer all required questions to generate the specification."
              : "All required questions answered. Ready to generate."}
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!canGenerate}
            className="font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              "Generate all phases"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
