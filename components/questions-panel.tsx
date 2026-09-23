"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateQuestionsAction, generateQuestionAnswerAction, generateAllQuestionAnswersAction, getGenerationTaskAction } from "@/lib/convex-actions";
import { BatchAiModal } from "./batch-ai-modal";
import { StressTestModal, type GrillSessionData } from "./stress-test-modal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getToastMessage } from "@/lib/notifications";
import { collectBatchAnswers } from "@/lib/batch-answers";
import { Loader2, RefreshCw, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { GenerationControls } from "@/components/generation-controls";
import { QuestionRow } from "@/components/question-row";
import { useDebounce } from "@/lib/hooks/useDebounce";

type Question = {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
  suggestions?: string[];
  selectedSuggestionIndex?: number;
};

interface QuestionsPanelProps {
  projectId: string;
  phaseId: string;
  questions: Question[];
  grillSession?: GrillSessionData;
  onGeneratePhase?: () => void;
  isGenerating?: boolean;
  onCancelGeneration?: () => void;
  isCancelling?: boolean;
  canResume?: boolean;
  onResumePhase?: () => void;
}

export function QuestionsPanel({
  projectId,
  phaseId,
  questions,
  grillSession,
  onGeneratePhase,
  isGenerating = false,
  onCancelGeneration,
  isCancelling = false,
  canResume = false,
  onResumePhase,
}: QuestionsPanelProps) {
  const saveAnswer = useMutation(api.projects.saveAnswer);
  const generateQuestions = useAction(generateQuestionsAction);
  const generateQuestionAnswer = useAction(generateQuestionAnswerAction);
  const generateAllQuestionAnswers = useAction(generateAllQuestionAnswersAction);

  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [localAiGenerated, setLocalAiGenerated] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null);
  const [questionSuggestions, setQuestionSuggestions] = useState<Record<string, string[]>>({});
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isStressTestOpen, setIsStressTestOpen] = useState(false);
  const [isBatchStarting, setIsBatchStarting] = useState(false);
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const batchToastIdRef = useRef<string | number | null>(null);
  const batchStatusRef = useRef<string | null>(null);

  // Track pending saves
  const pendingSaveRef = useRef<Record<string, string>>({});
  const pendingAiGeneratedRef = useRef<Record<string, boolean>>({});
  const batchAnswers = useMemo(() => collectBatchAnswers(questions), [questions]);
  const batchTask = useQuery(
    getGenerationTaskAction,
    batchTaskId ? { taskId: batchTaskId as Id<"generationTasks"> } : "skip"
  );
  const isBatchGenerating =
    isBatchStarting || batchTask?.status === "in_progress";
  const batchProgress = Math.min(batchTask?.currentStep ?? 0, questions.length);

  // Initialize local answers from questions
  useEffect(() => {
    const initial: Record<string, string> = {};
    const initialAi: Record<string, boolean> = {};
    const initialSuggestions: Record<string, string[]> = {};
    questions.forEach(q => {
      if (q.answer) initial[q.id] = q.answer;
      if (q.aiGenerated !== undefined) initialAi[q.id] = q.aiGenerated;
      if (q.suggestions?.length) initialSuggestions[q.id] = q.suggestions;
    });
    setLocalAnswers(initial);
    setLocalAiGenerated(initialAi);
    setQuestionSuggestions(initialSuggestions);
  }, [questions]);

  useEffect(() => {
    if (!batchTask || !batchTaskId) return;
    if (batchTask.status === batchStatusRef.current) return;
    batchStatusRef.current = batchTask.status;

    const toastId = batchToastIdRef.current ?? undefined;
    if (batchTask.status === "completed") {
      const doneToast = getToastMessage("ai_batch_done");
      toast.success(doneToast.title, {
        id: toastId,
        description: doneToast.description,
      });
    } else if (batchTask.status === "failed") {
      const errorToast = getToastMessage("ai_batch_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
      setErrorMessage(
        batchTask.error || "Failed to generate answers. Please try again."
      );
    }
  }, [batchTask, batchTaskId]);

  useEffect(() => {
    if (batchTask && isBatchStarting) {
      setIsBatchStarting(false);
    }
  }, [batchTask, isBatchStarting]);

  const unansweredRequired = questions.filter((q) => q.required && !localAnswers[q.id]?.trim()).length;
  const allAnswered = unansweredRequired === 0;

  // Debounced save function
  const handleSaveAnswer = useCallback(async (questionId: string, value: string, aiGenerated?: boolean) => {
    setSavingId(questionId);
    try {
      await saveAnswer({ projectId: projectId as Id<"projects">, phaseId, questionId, answer: value, aiGenerated });
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
      await generateQuestions({ projectId: projectId as Id<"projects">, phaseId });
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
        projectId: projectId as Id<"projects">,
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

      // Store suggestions for chip display
      if (result.suggestions && result.suggestions.length > 0) {
        setQuestionSuggestions(prev => ({ ...prev, [questionId]: result.suggestions }));
      } else {
        setQuestionSuggestions(prev => ({ ...prev, [questionId]: [] }));
      }

      pendingSaveRef.current[questionId] = result.suggestedAnswer;
      pendingAiGeneratedRef.current[questionId] = true;
      const doneToast = getToastMessage("ai_answer_done");
      toast.success(doneToast.title, {
        id: toastId,
        description: doneToast.description,
      });
    } catch (error: unknown) {
      console.error("Failed to generate AI answer:", error);
      setErrorMessage((error as Error).message || "Failed to generate AI answer. Please try again.");
      const errorToast = getToastMessage("ai_answer_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
    } finally {
      setAiGeneratingId(null);
    }
  }

  function handleSuggestionSelect(questionId: string, suggestion: string) {
    setLocalAnswers(prev => ({ ...prev, [questionId]: suggestion }));
    setLocalAiGenerated(prev => ({ ...prev, [questionId]: true }));
    setQuestionSuggestions(prev => ({ ...prev, [questionId]: [] }));
    pendingSaveRef.current[questionId] = suggestion;
    pendingAiGeneratedRef.current[questionId] = true;
  }

  async function handleBatchAiGenerate() {
    setBatchTaskId(null);
    batchStatusRef.current = null;
    setIsBatchModalOpen(true);
    setIsBatchStarting(true);
    setErrorMessage(null);
    const startToast = getToastMessage("ai_batch_start");
    const toastId = toast.message(startToast.title, {
      description: startToast.description,
    });
    batchToastIdRef.current = toastId;

    try {
      const result = await generateAllQuestionAnswers({
        projectId: projectId as Id<"projects">,
        phaseId,
      });

      setBatchTaskId(result?.taskId ?? null);
      if (!result?.taskId) {
        throw new Error("Batch generation did not return a task id.");
      }
    } catch (error) {
      console.error("Failed to generate batch answers:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate answers. Please try again.");
      const errorToast = getToastMessage("ai_batch_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
      setIsBatchStarting(false);
    }
  }

  function handleCancelBatch() {
    setIsBatchModalOpen(false);
    setIsBatchStarting(false);
  }

  function handleBatchModalChange(open: boolean) {
    setIsBatchModalOpen(open);
    if (!open) {
      setIsBatchStarting(false);
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStressTestOpen(true)}
            className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5 text-amber-500" />
            Stress-Test Plan
            {grillSession?.totalQuestionsAsked ? (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {Math.min(grillSession.totalQuestionsAsked, 10)}/10
              </Badge>
            ) : null}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchAiGenerate}
            disabled={isBatchGenerating || (questions?.length ?? 0) === 0}
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
            {questions.map((question, idx) => (
              <QuestionRow
                key={question.id}
                question={question}
                index={idx}
                answer={getAnswerForQuestion(question)}
                isSaving={savingId === question.id}
                isSaved={savedId === question.id}
                isAiGenerating={aiGeneratingId === question.id}
                aiGenerated={getAiGeneratedForQuestion(question)}
                suggestions={questionSuggestions[question.id] ?? []}
                isPhaseGenerating={isGenerating}
                maxLength={2000}
                onAnswerChange={handleAnswerChange}
                onAiSuggest={handleAiSuggest}
                onSuggestionSelect={handleSuggestionSelect}
              />
            ))}
          </div>
        )}

        {questions.length > 0 && (
          <GenerationControls
            isGenerating={isGenerating}
            canGenerate={allAnswered}
            onGenerate={() => onGeneratePhase?.()}
            onCancel={onCancelGeneration}
            isCancelling={isCancelling}
            canResume={canResume}
            onResume={onResumePhase}
          />
        )}
      </CardContent>
      <BatchAiModal
        open={isBatchModalOpen}
        onOpenChange={handleBatchModalChange}
        isGenerating={isBatchGenerating}
        currentProgress={batchProgress}
        totalQuestions={questions.length}
        questions={questions}
        batchAnswers={batchAnswers}
        onCancel={handleCancelBatch}
      />
      <StressTestModal
        open={isStressTestOpen}
        onOpenChange={setIsStressTestOpen}
        projectId={projectId}
        phaseId={phaseId}
        grillSession={grillSession}
      />
    </Card>
  );
}
