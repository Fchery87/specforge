"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BatchAiModal } from "./batch-ai-modal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { getToastMessage } from "@/lib/notifications";
import { Loader2, Check, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
};

interface QuestionsPanelProps {
  projectId: string;
  phaseId: string;
  questions: Question[];
  onGeneratePhase?: () => void;
  isGenerating?: boolean;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function QuestionsPanel({
  projectId,
  phaseId,
  questions,
  onGeneratePhase,
  isGenerating = false,
}: QuestionsPanelProps) {
  const saveAnswer = useMutation(api.projects.saveAnswer);
  const generateQuestionsAction: any = (api as any)["actions/generateQuestions"]?.generateQuestions;
  const generateQuestionAnswerAction: any = (api as any)["actions/generateQuestionAnswer"]?.generateQuestionAnswer;
  const generateAllQuestionAnswersAction: any = (api as any)["actions/generateAllQuestionAnswers"]?.generateAllQuestionAnswers;
  const generateQuestions = useAction(generateQuestionsAction);
  const generateQuestionAnswer = useAction(generateQuestionAnswerAction);
  const generateAllQuestionAnswers = useAction(generateAllQuestionAnswersAction);

  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [localAiGenerated, setLocalAiGenerated] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchAnswers, setBatchAnswers] = useState<Array<{ questionId: string; answer: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track pending saves
  const pendingSaveRef = useRef<Record<string, string>>({});
  const pendingAiGeneratedRef = useRef<Record<string, boolean>>({});

  // Initialize local answers from questions
  useEffect(() => {
    const initial: Record<string, string> = {};
    const initialAi: Record<string, boolean> = {};
    questions.forEach(q => {
      if (q.answer) initial[q.id] = q.answer;
      if (q.aiGenerated !== undefined) initialAi[q.id] = q.aiGenerated;
    });
    setLocalAnswers(initial);
    setLocalAiGenerated(initialAi);
  }, [questions]);

  const unansweredRequired = questions.filter((q) => q.required && !localAnswers[q.id]?.trim()).length;
  const allAnswered = unansweredRequired === 0;

  // Debounced save function
  const handleSaveAnswer = useCallback(async (questionId: string, value: string, aiGenerated?: boolean) => {
    setSavingId(questionId);
    try {
      await saveAnswer({ projectId: projectId as any, phaseId, questionId, answer: value, aiGenerated });
      setSavedId(questionId);
      setTimeout(() => setSavedId(null), 2000);
    } catch (error) {
      console.error("Failed to save answer:", error);
    } finally {
      setSavingId(null);
    }
  }, [saveAnswer, projectId, phaseId]);

  // Handle answer change with local state and debounced save
  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setLocalAnswers(prev => ({ ...prev, [questionId]: value }));
    setLocalAiGenerated(prev => ({ ...prev, [questionId]: false }));
    pendingSaveRef.current[questionId] = value;
    pendingAiGeneratedRef.current[questionId] = false;
  }, []);

  // Debounced save effect
  const debouncedAnswers = useDebounce(localAnswers, 500);
  useEffect(() => {

    Object.entries(pendingSaveRef.current).forEach(([id, value]) => {
      if (debouncedAnswers[id] === value) {
        handleSaveAnswer(id, value, pendingAiGeneratedRef.current[id]);
        delete pendingSaveRef.current[id];
        delete pendingAiGeneratedRef.current[id];
      } else {
      }
    });
  }, [debouncedAnswers, handleSaveAnswer]);

  async function handleRegenerateQuestions() {
    setIsRegenerating(true);
    const startToast = getToastMessage("questions_start");
    const toastId = toast.message(startToast.title, {
      description: startToast.description,
    });
    try {
      await generateQuestions({ projectId, phaseId });
      const doneToast = getToastMessage("questions_done");
      toast.success(doneToast.title, {
        id: toastId,
        description: doneToast.description,
      });
    } catch (error) {
      const errorToast = getToastMessage("questions_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleAiSuggest(questionId: string) {
    setAiGeneratingId(questionId);
    setErrorMessage(null);
    const startToast = getToastMessage("ai_answer_start");
    const toastId = toast.message(startToast.title, {
      description: startToast.description,
    });
    try {
      const result = await generateQuestionAnswer({
        projectId,
        phaseId,
        questionId,
      });

      setLocalAnswers(prev => {
        const updated = {
          ...prev,
          [questionId]: result.suggestedAnswer,
        };
        return updated;
      });
      setLocalAiGenerated(prev => ({ ...prev, [questionId]: true }));

      pendingSaveRef.current[questionId] = result.suggestedAnswer;
      pendingAiGeneratedRef.current[questionId] = true;
      const doneToast = getToastMessage("ai_answer_done");
      toast.success(doneToast.title, {
        id: toastId,
        description: doneToast.description,
      });
    } catch (error: any) {
      console.error("Failed to generate AI answer:", error);
      setErrorMessage(error.message || "Failed to generate AI answer. Please try again.");
      const errorToast = getToastMessage("ai_answer_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
    } finally {
      setAiGeneratingId(null);
    }
  }

  async function handleBatchAiGenerate() {
    setIsBatchModalOpen(true);
    setIsBatchGenerating(true);
    setBatchProgress(0);
    setBatchAnswers([]);
    setErrorMessage(null);
    const startToast = getToastMessage("ai_batch_start");
    const toastId = toast.message(startToast.title, {
      description: startToast.description,
    });

    try {
      const result = await generateAllQuestionAnswers({
        projectId,
        phaseId,
      });

      setBatchAnswers(result.answers);
      setBatchProgress(result.answers.length);
      const doneToast = getToastMessage("ai_batch_done");
      toast.success(doneToast.title, {
        id: toastId,
        description: doneToast.description,
      });
    } catch (error: any) {
      console.error("Failed to generate batch answers:", error);
      setErrorMessage(error.message || "Failed to generate answers. Please try again.");
      setIsBatchModalOpen(false);
      const errorToast = getToastMessage("ai_batch_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
    } finally {
      setIsBatchGenerating(false);
    }
  }

  function handleAcceptBatchAnswers() {
    // Update local state with all batch answers
    const updates: Record<string, string> = {};
    batchAnswers.forEach(({ questionId, answer }) => {
      updates[questionId] = answer;
      pendingSaveRef.current[questionId] = answer;
      pendingAiGeneratedRef.current[questionId] = true;
    });

    setLocalAnswers(prev => ({ ...prev, ...updates }));
    setLocalAiGenerated(prev => ({
      ...prev,
      ...Object.fromEntries(batchAnswers.map(({ questionId }) => [questionId, true])),
    }));
    setIsBatchModalOpen(false);
    setBatchAnswers([]);
    setBatchProgress(0);
  }

  function handleCancelBatch() {
    setIsBatchModalOpen(false);
    setBatchAnswers([]);
    setBatchProgress(0);
  }

  const getAnswerForQuestion = (q: Question) => localAnswers[q.id] ?? q.answer ?? "";
  const getAiGeneratedForQuestion = (q: Question) =>
    localAiGenerated[q.id] ?? q.aiGenerated ?? false;

  return (
    <Card variant="static">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <CardTitle className="text-xl normal-case tracking-normal font-semibold">
            Questions & Clarifications
          </CardTitle>
          <CardDescription className="mt-1">
            Answer these questions to help generate better artifacts.
            {unansweredRequired > 0 && (
              <span className="text-warning ml-2 font-medium">
                {unansweredRequired} required question{unansweredRequired !== 1 ? "s" : ""} unanswered
              </span>
            )}
          </CardDescription>
          {errorMessage && (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchAiGenerate}
            disabled={isBatchGenerating || questions.length === 0}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Let AI answer all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateQuestions}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.length === 0 ? (
          <EmptyState
            variant="default"
            title="No Questions Yet"
            description="Generate questions to get started with this phase."
            action={{
              label: "Generate Questions",
              onClick: handleRegenerateQuestions,
            }}
            className="py-8"
          />
        ) : (
          <div className="space-y-8">
            {questions.map((question, idx) => {
              const answer = getAnswerForQuestion(question);
              const isSaving = savingId === question.id;
              const isSaved = savedId === question.id;
              const maxLength = 2000;
              const charCount = answer.length;

              return (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 border-2 border-border bg-secondary/30 text-sm font-bold">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <p className={cn("text-base", question.required && "font-medium")}>
                        {question.text}
                        {question.required && <span className="text-warning ml-1">*</span>}
                      </p>
                      {getAiGeneratedForQuestion(question) && (
                        <span className="inline-flex items-center text-xs text-muted-foreground mt-1">
                          <Sparkles className="w-3 h-3 mr-1" /> AI suggested
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-11 space-y-2">
                    <div className="flex items-center gap-2">
                      <Textarea
                        value={answer}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Enter your answer..."
                        className="min-h-[100px] flex-1"
                        maxLength={maxLength}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAiSuggest(question.id)}
                        disabled={aiGeneratingId === question.id || isGenerating}
                        className="self-start"
                      >
                        {aiGeneratingId === question.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {isSaving && (
                          <span className="flex items-center text-muted-foreground">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Saving...
                          </span>
                        )}
                        {isSaved && (
                          <span className="flex items-center text-success">
                            <Check className="w-3 h-3 mr-1" />
                            Saved
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-muted-foreground",
                        charCount > maxLength * 0.9 && "text-warning"
                      )}>
                        {charCount.toLocaleString()}/{maxLength.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {questions.length > 0 && (
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {allAnswered ? "All required questions answered" : `${unansweredRequired} required question${unansweredRequired !== 1 ? 's' : ''} remaining`}
            </p>
            <Button
              onClick={onGeneratePhase}
              disabled={!allAnswered || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Phase"
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <BatchAiModal
        open={isBatchModalOpen}
        onOpenChange={setIsBatchModalOpen}
        isGenerating={isBatchGenerating}
        currentProgress={batchProgress}
        totalQuestions={questions.length}
        questions={questions}
        batchAnswers={batchAnswers}
        onAcceptAll={handleAcceptBatchAnswers}
        onCancel={handleCancelBatch}
      />
    </Card>
  );
}
