export type ToastEvent =
  | "questions_start"
  | "questions_done"
  | "questions_error"
  | "ai_answer_start"
  | "ai_answer_done"
  | "ai_answer_error"
  | "ai_batch_start"
  | "ai_batch_done"
  | "ai_batch_error";

export type ToastMessage = {
  title: string;
  description?: string;
};

const TOAST_MESSAGES: Record<ToastEvent, ToastMessage> = {
  questions_start: {
    title: "Generating questions",
    description: "Building phase-specific prompts",
  },
  questions_done: {
    title: "Questions ready",
    description: "Review and refine before continuing",
  },
  questions_error: {
    title: "Question generation failed",
    description: "Try again in a moment",
  },
  ai_answer_start: {
    title: "AI answering",
    description: "Drafting a focused response",
  },
  ai_answer_done: {
    title: "AI answer ready",
    description: "Review and edit as needed",
  },
  ai_answer_error: {
    title: "AI answer failed",
    description: "Try again or answer manually",
  },
  ai_batch_start: {
    title: "AI answering all",
    description: "Generating a full batch",
  },
  ai_batch_done: {
    title: "AI batch complete",
    description: "Review answers before saving",
  },
  ai_batch_error: {
    title: "Batch generation failed",
    description: "Try again in a moment",
  },
};

export function getToastMessage(event: ToastEvent): ToastMessage {
  return TOAST_MESSAGES[event];
}
