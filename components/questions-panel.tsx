"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Loader2, Check, RefreshCw, Sparkles } from "lucide-react";

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
  const generateQuestions = useAction(api.actions.generateQuestions as any);
  
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Track pending saves
  const pendingSaveRef = useRef<Record<string, string>>({});

  // Initialize local answers from questions
  useEffect(() => {
    const initial: Record<string, string> = {};
    questions.forEach(q => {
      if (q.answer) initial[q.id] = q.answer;
    });
    setLocalAnswers(initial);
  }, [questions]);

  const unansweredRequired = questions.filter((q) => q.required && !localAnswers[q.id]?.trim()).length;
  const allAnswered = unansweredRequired === 0;

  // Debounced save function
  const handleSaveAnswer = useCallback(async (questionId: string, value: string) => {
    setSavingId(questionId);
    try {
      await saveAnswer({ projectId: projectId as any, phaseId, questionId, answer: value });
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
    pendingSaveRef.current[questionId] = value;
  }, []);

  // Debounced save effect
  const debouncedAnswers = useDebounce(localAnswers, 500);
  useEffect(() => {
    Object.entries(pendingSaveRef.current).forEach(([id, value]) => {
      if (debouncedAnswers[id] === value) {
        handleSaveAnswer(id, value);
        delete pendingSaveRef.current[id];
      }
    });
  }, [debouncedAnswers, handleSaveAnswer]);

  async function handleRegenerateQuestions() {
    setIsRegenerating(true);
    try {
      await generateQuestions({ projectId, phaseId });
    } finally {
      setIsRegenerating(false);
    }
  }

  const getAnswerForQuestion = (q: Question) => localAnswers[q.id] ?? q.answer ?? "";

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
        </div>
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
                      {question.aiGenerated && (
                        <span className="inline-flex items-center text-xs text-muted-foreground mt-1">
                          <Sparkles className="w-3 h-3 mr-1" /> AI suggested
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-11">
                    <Textarea
                      value={answer}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="Enter your answer..."
                      className="min-h-[100px]"
                      maxLength={maxLength}
                    />
                    <div className="flex items-center justify-between mt-2 text-xs">
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
    </Card>
  );
}
