# AI Question Answering Feature

## Overview

SpecForge includes AI-powered features to help users answer specification questions efficiently:

1. **Individual Question AI Suggest** - Get AI-generated answer suggestions for single questions
2. **Batch AI Answer All** - Automatically answer all unanswered questions in a specification phase

Both features leverage the system's LLM registry and credential management to provide intelligent, context-aware responses.

---

## Individual Question AI Suggest

### Description

For any unanswered question in a specification phase, users can click an "AI Suggest" button to get an AI-generated answer suggestion. The AI analyzes the question text and phase context to provide a relevant response.

### How It Works

1. User clicks "AI Suggest" button next to a question
2. Frontend calls `answerQuestion` action with `useAI: true`
3. Backend:
   - Retrieves system LLM credentials
   - Constructs prompt with question and context
   - Calls LLM API
   - Returns suggested answer
4. Frontend displays suggestion in answer textarea
5. User can edit, approve, or regenerate

### User Experience

- Button appears next to unanswered questions
- Loading state while AI generates answer
- Suggested answer populates textarea
- User has full control to modify before saving
- Error handling for API failures

---

## Batch AI Answer All

### Description

Users can answer all unanswered questions in a specification phase with a single action. This feature is particularly useful for:

- Large specifications with many questions
- Initial draft generation
- Rapid prototyping
- Baseline answer creation for further refinement

### How It Works

1. User clicks "AI Answer All" button on phase card
2. Frontend calls `batchAnswerQuestions` action with phase ID
3. Backend:
   - Queries all questions in the phase
   - Filters to unanswered questions only
   - For each question:
     - Constructs context-aware prompt
     - Calls LLM API
     - Updates question with AI-generated answer
   - Returns summary of results
4. Frontend updates UI with new answers
5. User can review and edit any generated answers

### User Experience

- "AI Answer All" button on phase cards
- Progress indicator during batch operation
- Success/failure notifications
- Questions update in real-time
- Ability to undo or edit individual answers

---

## Implementation Details

### Backend Actions

#### `answerQuestion` (`convex/actions/answerQuestion.ts`)

```typescript
export const answerQuestion = internalAction({
  args: {
    questionId: v.id("questions"),
    answer: v.string(),
    useAI: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.useAI) {
      // Get system credentials
      // Call LLM with question context
      // Return AI-generated answer
    } else {
      // Direct answer update
    }
  }
});
```

#### `batchAnswerQuestions` (`convex/actions/batchAnswerQuestions.ts`)

```typescript
export const batchAnswerQuestions = internalAction({
  args: {
    phaseId: v.id("phases"),
  },
  handler: async (ctx, args) => {
    // Get all questions for phase
    // Filter unanswered questions
    // For each question, call answerQuestion with useAI: true
    // Return batch results
  }
});
```

### Frontend Components

#### Question Component

- Displays AI Suggest button
- Handles loading states
- Populates textarea with AI response
- Error handling UI

#### Phase Component

- Displays AI Answer All button
- Shows batch progress
- Updates question list on completion
- Displays summary statistics

---

## Configuration

### LLM Provider Setup

1. Configure system credentials in Settings
2. Select preferred LLM provider (OpenAI, Anthropic, OpenRouter)
3. Set API keys in system credentials
4. Choose model for question answering

### Default Behavior

- **Model**: Uses system default or first available
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Max Tokens**: 500 (sufficient for most answers)
- **Retry Logic**: 3 attempts with exponential backoff

---

## Usage Instructions

### For Users

1. **Individual Question AI Suggest:**
   - Navigate to a specification phase
   - Find an unanswered question
   - Click "AI Suggest" button
   - Review generated answer
   - Edit if needed
   - Save answer

2. **Batch AI Answer All:**
   - Navigate to specification overview
   - Find phase with unanswered questions
   - Click "AI Answer All" on phase card
   - Wait for batch completion
   - Review all generated answers
   - Edit individual answers as needed

### For Developers

See implementation in:
- `/convex/actions/answerQuestion.ts`
- `/convex/actions/batchAnswerQuestions.ts`
- `/app/specifications/[id]/page.tsx`
- `/components/phase-card.tsx`

---

## Future Enhancements

1. **Custom Prompts**: Allow users to customize AI prompts per question type
2. **Multi-Model Support**: Let users choose different models for different questions
3. **Answer Quality Scoring**: AI confidence scores for generated answers
4. **Iterative Refinement**: "Regenerate" button to get alternative answers
5. **Context Injection**: Use project documentation and previous answers as context
6. **Batch Configuration**: Configure batch size and concurrency limits
7. **Answer Templates**: Pre-defined templates for common question types
8. **Review Queue**: Workflow for reviewing AI-generated answers before approval
