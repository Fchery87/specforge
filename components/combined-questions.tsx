"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WORKFLOW_STAGES } from "@/lib/workflow";

export interface QuestionData {
  id: string;
  text: string;
  answer?: string;
  required?: boolean;
  aiGenerated?: boolean;
  suggestions?: string[];
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
  aiGenerated?: boolean;
}

export interface CombinedQuestionsProps {
  projectId: string;
  phases: PhaseQuestionsData[];
  skippedPhases?: readonly string[];
  isGenerating?: boolean;
  onGenerateEverything?: (answers: CombinedAnswerItem[]) => Promise<void> | void;
  onRequestSuggestions?: (phaseId: string) => Promise<void> | void;
  className?: string;
}

export function CombinedQuestions({
  projectId,
  phases,
  skippedPhases = [],
  isGenerating = false,
  onGenerateEverything,
  onRequestSuggestions,
  className,
}: CombinedQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSuggestion, setIsSuggestion] = useState<Record<string, boolean>>({});

  // Initialize answers and suggestions from phase questions
  useEffect(() => {
    const initialAnswers: Record<string, string> = {};
    const initialSuggestions: Record<string, boolean> = {};

    phases.forEach((phase) => {
      if (skippedPhases.includes(phase.phaseId)) return;

      phase.questions?.forEach((q) => {
        if (q.answer !== undefined && q.answer !== "") {
          initialAnswers[q.id] = q.answer;
          initialSuggestions[q.id] = Boolean(q.aiGenerated);
        } else if (q.suggestions && q.suggestions.length > 0) {
          // Pre-fill first suggestion if no answer exists
          initialAnswers[q.id] = q.suggestions[0];
          initialSuggestions[q.id] = true;
        } else {
          initialAnswers[q.id] = "";
          initialSuggestions[q.id] = false;
        }
      });
    });

    setAnswers((prev) => ({ ...initialAnswers, ...prev }));
    setIsSuggestion((prev) => ({ ...initialSuggestions, ...prev }));
  }, [phases, skippedPhases]);

  function handleAnswerChange(questionId: string, val: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    setIsSuggestion((prev) => ({ ...prev, [questionId]: false }));
  }

  function handleAcceptSuggestion(questionId: string) {
    setIsSuggestion((prev) => ({ ...prev, [questionId]: false }));
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

  const canGenerate = !hasEmptyRequired && !isGenerating;

  async function handleSubmit() {
    if (!canGenerate || !onGenerateEverything) return;
    const items: CombinedAnswerItem[] = allEnabledQuestions.map(({ phaseId, question }) => ({
      phaseId,
      questionId: question.id,
      answer: answers[question.id] ?? "",
      aiGenerated: isSuggestion[question.id],
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
            <Card key={stage.id} className="border-2">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-tight">
                      {stage.label}
                    </h2>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      {stage.summary}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {stagePhasesWithQuestions.map(({ phaseId, phaseLabel, questions }) => (
                  <div key={phaseId} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        {phaseLabel}
                      </h3>
                      {onRequestSuggestions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestSuggestions(phaseId)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Sparkles className="w-3 h-3 mr-1 text-primary" />
                          Refresh suggestions
                        </Button>
                      )}
                    </div>
                    <div className="space-y-6">
                      {questions.map((q, idx) => {
                        const currentAnswer = answers[q.id] ?? "";
                        const showingSuggestion = isSuggestion[q.id] ?? false;

                        return (
                          <div key={q.id} className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <label
                                htmlFor={`q-${q.id}`}
                                className="text-sm font-medium leading-relaxed"
                              >
                                <span className="text-muted-foreground font-mono mr-2">
                                  {String(idx + 1).padStart(2, "0")}.
                                </span>
                                {q.text}
                                {q.required && (
                                  <span className="text-destructive ml-1">*</span>
                                )}
                              </label>
                              {showingSuggestion && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-500/10 text-amber-500 border-amber-500/30"
                                  >
                                    Suggestion
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAcceptSuggestion(q.id)}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Accept
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
                              className="w-full text-sm resize-y"
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

        {/* Generate Everything Bar */}
        <div className="sticky bottom-6 z-20 p-4 bg-background/95 backdrop-blur border border-border shadow-lg rounded-xl flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {hasEmptyRequired
              ? "Answer all required questions to generate the specification."
              : "All required questions answered. Ready to generate."}
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!canGenerate}
            className="font-bold uppercase tracking-wider"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              "Generate everything"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
