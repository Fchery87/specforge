"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchAnswer {
  questionId: string;
  answer: string;
}

interface Question {
  id: string;
  text: string;
  answer?: string;
}

interface BatchAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGenerating: boolean;
  currentProgress?: number;
  totalQuestions?: number;
  questions: Question[];
  batchAnswers: BatchAnswer[];
  onAcceptAll?: () => void;
  onCancel: () => void;
}

export function BatchAiModal({
  open,
  onOpenChange,
  isGenerating,
  currentProgress = 0,
  totalQuestions = 0,
  questions,
  batchAnswers,
  onCancel,
}: BatchAiModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            AI-Generated Answers
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? `Generating answers... (${currentProgress} of ${totalQuestions})`
              : "Review the AI-generated answers below"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {questions.map((question, idx) => {
              const batchAnswer = batchAnswers?.find(
                (ba) => ba.questionId === question.id
              );
              const isProcessed = idx < currentProgress;
              const isProcessing = idx === currentProgress && isGenerating;

              return (
                <div key={question.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 flex items-center justify-center size-6 border border-line bg-raised/30 text-caption font-bold">
                      {idx + 1}
                    </span>
                    <p className="text-ui font-medium flex-1">{question.text}</p>
                    {isProcessing && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                    {isProcessed && !isProcessing && (
                      <Check className="size-4 text-success" />
                    )}
                  </div>
                  {batchAnswer && (
                    <div className="ml-8 p-3 bg-raised/50 rounded-sm">
                      <p className="text-ui">{batchAnswer.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-muted-foreground">
            Answers are saved automatically.
          </p>
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
