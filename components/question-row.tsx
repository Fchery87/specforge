"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Check, Sparkles } from "lucide-react";

interface QuestionRowProps {
  question: {
    id: string;
    text: string;
    answer?: string;
    required?: boolean;
    suggestions?: string[];
    selectedSuggestionIndex?: number;
  };
  index: number;
  answer: string;
  isSaving: boolean;
  isSaved: boolean;
  isAiGenerating: boolean;
  /** The assistant wrote the answer, however far the user has reviewed it. */
  modelWritten: boolean;
  suggestions: string[];
  selectedSuggestionIndex?: number;
  stagedAnswer?: string | null;
  /** What the question is for, e.g. "Feeds Requirements". */
  feedsLabel?: string;
  /** The answer was written by the assistant and the user has not reviewed it. */
  assumed?: boolean;
  isPhaseGenerating: boolean;
  maxLength: number;
  onAnswerChange: (questionId: string, value: string) => void;
  onAiSuggest: (questionId: string) => void;
  onSuggestionSelect: (questionId: string, suggestion: string, index: number) => void;
  onAcceptStaged?: (questionId: string) => void;
  onDismissStaged?: (questionId: string) => void;
  onKeepAssumed?: (questionId: string) => void;
}

export function QuestionRow({
  question,
  index,
  answer,
  isSaving,
  isSaved,
  isAiGenerating,
  modelWritten,
  suggestions,
  selectedSuggestionIndex,
  stagedAnswer,
  feedsLabel,
  assumed = false,
  isPhaseGenerating,
  maxLength,
  onAnswerChange,
  onAiSuggest,
  onSuggestionSelect,
  onAcceptStaged,
  onDismissStaged,
  onKeepAssumed,
}: QuestionRowProps) {
  const charCount = answer.length;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 flex items-center justify-center size-8 border border-line bg-raised/30 text-ui font-semibold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1">
          <p className={cn("text-body", question.required && "font-medium")}>
            {question.text}
            {question.required && <span className="text-warning ml-1">*</span>}
          </p>
          {feedsLabel && (
            <p className="text-caption text-muted-foreground mt-1">{feedsLabel}</p>
          )}
          {modelWritten && (
            <span className="inline-flex items-center text-caption text-muted-foreground mt-1">
              <Sparkles className="size-3 mr-1" /> AI suggested
            </span>
          )}
        </div>
      </div>
      <div className="ml-11 space-y-2">
        <label htmlFor={`answer-${question.id}`} className="sr-only">
          Answer for question {index + 1}. {question.text}
        </label>
        <div className="flex items-center gap-2">
          <Textarea
            id={`answer-${question.id}`}
            value={answer}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
            className="min-h-[100px] flex-1"
            maxLength={maxLength}
            aria-label={`Answer for question ${index + 1}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAiSuggest(question.id)}
            disabled={isAiGenerating || isPhaseGenerating}
            className="self-start"
            aria-label={`Get AI suggestion for question ${index + 1}`}
          >
            {isAiGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between text-caption">
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="flex items-center text-muted-foreground">
                <Loader2 className="size-3 mr-1 animate-spin" />
                Saving...
              </span>
            )}
            {isSaved && (
              <span className="flex items-center text-success">
                <Check className="size-3 mr-1" />
                Saved
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-muted-foreground",
              charCount > maxLength * 0.9 && "text-warning",
            )}
          >
            {charCount.toLocaleString()}/{maxLength.toLocaleString()}
          </span>
        </div>

        {assumed && answer.trim() && (
          <div className="flex items-center justify-between gap-2 p-2 bg-warning/10 border border-warning/20 rounded-sm">
            <span className="text-caption text-warning">
              Assumed. The assistant wrote this and you have not reviewed it, so the document will say so.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-caption gap-1 shrink-0"
              onClick={() => onKeepAssumed?.(question.id)}
            >
              <Check className="size-3.5" />
              Keep
            </Button>
          </div>
        )}

        {stagedAnswer && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary">
                <Sparkles className="size-3.5" />
                Suggested answer
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-caption text-muted-foreground hover:text-ink"
                  onClick={() => onDismissStaged?.(question.id)}
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 px-2.5 text-caption gap-1"
                  onClick={() => onAcceptStaged?.(question.id)}
                >
                  <Check className="size-3.5" />
                  Accept
                </Button>
              </div>
            </div>
            <p className="text-caption text-ink/90 whitespace-pre-wrap leading-relaxed">
              {stagedAnswer}
            </p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-caption text-muted-foreground font-medium">
              Suggested options
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, chipIdx) => {
                const isSelected = selectedSuggestionIndex === chipIdx;
                return (
                  <button
                    key={`${suggestion}-${chipIdx}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSuggestionSelect(question.id, suggestion, chipIdx)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 text-caption text-left border rounded-sm transition-colors cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-line/60 bg-raised/30 text-muted-foreground hover:bg-raised/60 hover:text-ink hover:border-line",
                    )}
                  >
                    {isSelected ? (
                      <Check className="size-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <Sparkles className="size-3.5 text-muted-foreground/70 flex-shrink-0" />
                    )}
                    <span>{suggestion}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
