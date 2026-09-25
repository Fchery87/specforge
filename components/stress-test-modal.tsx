"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import {
  generateGrillRoundAction,
  saveGrillAnswersAction,
  resetGrillSessionAction,
} from "@/lib/convex-actions";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  Loader2,
  Check,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export interface GrillRoundQuestion {
  id: string;
  text: string;
  recommendedAnswer: string;
  options?: string[];
  category?: string;
  userAnswer?: string;
  acceptedRecommendation?: boolean;
}

export interface GrillRoundData {
  roundNumber: number;
  questions: GrillRoundQuestion[];
}

export interface GrillSessionData {
  totalQuestionsAsked: number;
  currentRound: number;
  isComplete: boolean;
  rounds: GrillRoundData[];
}

interface StressTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId: string;
  grillSession?: GrillSessionData;
  onAnswersSaved?: () => void;
}

interface LocalGrillQuestion {
  id: string;
  text: string;
  recommendedAnswer?: string;
  suggestions?: string[];
  answer: string;
  userConfirmed: boolean;
  round: number;
}

export function StressTestModal({
  open,
  onOpenChange,
  projectId,
  phaseId,
  grillSession,
  onAnswersSaved,
}: StressTestModalProps) {
  const generateGrillRound = useAction(generateGrillRoundAction);
  const saveGrillAnswers = useMutation(saveGrillAnswersAction);
  const resetGrillSession = useMutation(resetGrillSessionAction);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<LocalGrillQuestion[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [reachedLimit, setReachedLimit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalAsked = grillSession?.totalQuestionsAsked ?? 0;
  const isCapped = totalAsked >= 10;

  const loadRound = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await generateGrillRound({
        projectId: projectId as Id<"projects">,
        phaseId,
      });

      const typedResult = result as {
        questions: Array<{
          id: string;
          text: string;
          recommendedAnswer?: string;
          suggestions?: string[];
        }>;
        currentRound: number;
        reachedLimit: boolean;
      } | null;

      if (!typedResult || typedResult.questions.length === 0) {
        setReachedLimit(true);
        setCurrentQuestions([]);
        return;
      }

      setCurrentRound(typedResult.currentRound);
      setReachedLimit(typedResult.reachedLimit);

      const mapped: LocalGrillQuestion[] = typedResult.questions.map((q) => {
        const rec =
          q.recommendedAnswer?.trim() ||
          (q.suggestions && q.suggestions.length > 0
            ? q.suggestions[0]
            : "Standard 2026 production-grade architecture practice");
        return {
          id: q.id,
          text: q.text,
          recommendedAnswer: rec,
          suggestions: q.suggestions && q.suggestions.length > 0 ? q.suggestions : [rec],
          answer: rec,
          userConfirmed: true,
          round: typedResult.currentRound,
        };
      });

      setCurrentQuestions(mapped);
    } catch (err) {
      console.error("Failed to load grilling round:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate stress test questions."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && currentQuestions.length === 0 && !isCapped) {
      void loadRound();
    }
  }, [open, isCapped]);

  const handleUpdateAnswer = (id: string, text: string) => {
    setCurrentQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, answer: text, userConfirmed: true } : q))
    );
  };

  const handleAcceptRecommendation = (id: string) => {
    setCurrentQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id && q.recommendedAnswer) {
          return {
            ...q,
            answer: q.recommendedAnswer,
            userConfirmed: true,
          };
        }
        return q;
      })
    );
    toast.success("Recommendation accepted");
  };

  const handleSaveAnswers = async (proceedToNextRound = false) => {
    if (currentQuestions.length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const payload = currentQuestions.map((q) => ({
        questionId: q.id,
        questionText: q.text,
        answer: q.answer.trim() || q.recommendedAnswer || "Accepted default recommendation",
        recommendedAnswer: q.recommendedAnswer || "Standard production practice",
        acceptedRecommendation: q.userConfirmed,
        options: q.suggestions,
        round: q.round,
      }));

      await saveGrillAnswers({
        projectId: projectId as Id<"projects">,
        phaseId,
        answers: payload,
      });

      toast.success("Stress-test answers recorded");
      onAnswersSaved?.();

      if (proceedToNextRound && !reachedLimit) {
        setCurrentQuestions([]);
        await loadRound();
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Failed to save grill answers:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to record stress-test answers."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSession = async () => {
    setIsResetting(true);
    setErrorMessage(null);
    try {
      await resetGrillSession({
        projectId: projectId as Id<"projects">,
        phaseId,
      });
      setCurrentQuestions([]);
      setReachedLimit(false);
      toast.success("Stress-test session reset");
      onAnswersSaved?.();
      void loadRound();
    } catch (err) {
      console.error("Failed to reset session:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to reset stress-test session."
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[88vh] h-[88vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 space-y-2 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Stress-Test Plan
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Round {currentRound}
              </Badge>
              <Badge
                variant={totalAsked >= 10 ? "destructive" : "secondary"}
                className="text-xs"
              >
                {Math.min(totalAsked, 10)} / 10 Max Questions
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-sm">
            Principal architect grilling interview. Pressure-tests edge cases, failure
            modes, and data invariants in short rounds. Each question includes an
            opinionated 2026 standard recommendation.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="shrink-0 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-3 py-2 space-y-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Generating frontier stress-test questions...</p>
            </div>
          ) : isCapped && currentQuestions.length === 0 ? (
            <div className="py-8 space-y-4">
              <div className="p-4 rounded-lg bg-muted/60 border border-border text-center space-y-2">
                <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
                <h4 className="font-medium text-base">
                  Stress-Test Limit Reached (10 / 10)
                </h4>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  You completed all 10 stress-test questions for this phase. All
                  clarifications have been merged into the phase context.
                </p>
              </div>

              {grillSession?.rounds && grillSession.rounds.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirmed Architectural Decisions
                  </h5>
                  {grillSession.rounds
                    .flatMap((r) => r.questions)
                    .map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-md border border-border bg-card/50 text-sm space-y-1"
                      >
                        <p className="font-medium text-foreground">
                          {idx + 1}. {item.text}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {item.userAnswer || item.recommendedAnswer}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {currentQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-lg border border-border bg-card space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      data-testid="grill-question-text"
                      className="font-medium text-sm leading-snug"
                    >
                      <span className="text-muted-foreground mr-1">
                        {idx + 1}.
                      </span>
                      {q.text}
                    </p>
                  </div>

                  {q.recommendedAnswer && (
                    <div
                      className={cn(
                        "p-3.5 rounded-md border space-y-2 transition-colors cursor-pointer",
                        q.answer.trim() === q.recommendedAnswer.trim()
                          ? "bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30"
                          : "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15",
                      )}
                      onClick={() => handleAcceptRecommendation(q.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          Recommended 2026 Standard
                          {q.answer.trim() === q.recommendedAnswer.trim() && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 ml-1 py-0 px-1.5"
                            >
                              Selected
                            </Badge>
                          )}
                        </span>
                        <Button
                          type="button"
                          variant={
                            q.answer.trim() === q.recommendedAnswer.trim()
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptRecommendation(q.id);
                          }}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Accept
                        </Button>
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed">
                        {q.recommendedAnswer}
                      </p>
                    </div>
                  )}

                  {q.suggestions && q.suggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Select an Option:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {q.suggestions.map((suggestion, sIdx) => {
                          const isSelected = q.answer.trim() === suggestion.trim();
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              aria-pressed={isSelected}
                              className={cn(
                                "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer text-left",
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                              onClick={() => handleUpdateAnswer(q.id, suggestion)}
                            >
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                              )}
                              <span>{suggestion}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Decision / Custom Refinements
                    </label>
                    <Textarea
                      value={q.answer}
                      onChange={(e) => handleUpdateAnswer(q.id, e.target.value)}
                      placeholder="Write your decision or edit the recommendation..."
                      className="min-h-[70px] text-xs resize-y"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <div>
            {totalAsked > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={handleResetSession}
                disabled={isResetting || isLoading}
              >
                {isResetting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Reset Stress Test
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Done / Close
            </Button>

            {!isCapped && currentQuestions.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSaveAnswers(false)}
                  disabled={isSaving || isLoading}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save Answers
                </Button>

                {!reachedLimit && totalAsked + currentQuestions.length < 10 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveAnswers(true)}
                    disabled={isSaving || isLoading}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Save & Next Round
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
