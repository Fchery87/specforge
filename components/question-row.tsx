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
    aiGenerated?: boolean;
    required?: boolean;
    suggestions?: string[];
    selectedSuggestionIndex?: number;
  };
  index: number;
  answer: string;
  isSaving: boolean;
  isSaved: boolean;
  isAiGenerating: boolean;
  aiGenerated: boolean;
  suggestions: string[];
  selectedSuggestionIndex?: number;
  stagedAnswer?: string | null;
  isPhaseGenerating: boolean;
  maxLength: number;
  onAnswerChange: (questionId: string, value: string) => void;
  onAiSuggest: (questionId: string) => void;
  onSuggestionSelect: (questionId: string, suggestion: string, index: number) => void;
  onAcceptStaged?: (questionId: string) => void;
  onDismissStaged?: (questionId: string) => void;
}

export function QuestionRow({
  question,
  index,
  answer,
  isSaving,
  isSaved,
  isAiGenerating,
  aiGenerated,
  suggestions,
  selectedSuggestionIndex,
  stagedAnswer,
  isPhaseGenerating,
  maxLength,
  onAnswerChange,
  onAiSuggest,
  onSuggestionSelect,
  onAcceptStaged,
  onDismissStaged,
}: QuestionRowProps) {
  const charCount = answer.length;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 border-2 border-border bg-secondary/30 text-sm font-bold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1">
          <p className={cn("text-base", question.required && "font-medium")}>
            {question.text}
            {question.required && <span className="text-warning ml-1">*</span>}
          </p>
          {aiGenerated && (
            <span className="inline-flex items-center text-xs text-muted-foreground mt-1">
              <Sparkles className="w-3 h-3 mr-1" /> AI suggested
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
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
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
          <span
            className={cn(
              "text-muted-foreground",
              charCount > maxLength * 0.9 && "text-warning",
            )}
          >
            {charCount.toLocaleString()}/{maxLength.toLocaleString()}
          </span>
        </div>

        {stagedAnswer && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Suggested answer
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onDismissStaged?.(question.id)}
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => onAcceptStaged?.(question.id)}
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </Button>
              </div>
            </div>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {stagedAnswer}
            </p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
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
                      "inline-flex items-center gap-2 px-3 py-1.5 text-xs text-left border rounded transition-colors cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                        : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground hover:border-border",
                    )}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
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
