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
  };
  index: number;
  answer: string;
  isSaving: boolean;
  isSaved: boolean;
  isAiGenerating: boolean;
  aiGenerated: boolean;
  suggestions: string[];
  isPhaseGenerating: boolean;
  maxLength: number;
  onAnswerChange: (questionId: string, value: string) => void;
  onAiSuggest: (questionId: string) => void;
  onSuggestionSelect: (questionId: string, suggestion: string) => void;
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
  isPhaseGenerating,
  maxLength,
  onAnswerChange,
  onAiSuggest,
  onSuggestionSelect,
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
          Answer for question {index + 1}: {question.text}
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
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Suggested answers
            </span>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((suggestion, chipIdx) => (
                <button
                  key={`${suggestion}-${chipIdx}`}
                  type="button"
                  onClick={() => onSuggestionSelect(question.id, suggestion)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs text-left border border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-border transition-colors cursor-pointer rounded-sm"
                >
                  <Sparkles className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
