# Prompt Enhance Feature

## Overview

The **Prompt Enhance** feature is an AI-powered tool that transforms vague, brief, or unstructured project descriptions into comprehensive, detailed software specification prompts. This feature helps users create better project descriptions that result in higher-quality AI-generated specifications.

## How It Works

1. User enters a brief project description
2. Clicks the "Enhance" button (or presses Ctrl/Cmd + E)
3. AI analyzes the input and expands it into a structured specification
4. User reviews the enhanced version in a side-by-side preview
5. User can apply the enhancement or keep the original

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PromptEnhanceButton Component                      │   │
│  │  - Loading states with animations                   │   │
│  │  - Preview dialog (original vs enhanced)            │   │
│  │  - Undo/Revert functionality                        │   │
│  │  - Keyboard shortcuts (Ctrl/Cmd + E)                │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/Action
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Convex Actions)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  enhancePrompt Action                               │   │
│  │  - Input validation (10-5000 chars)                 │   │
│  │  - Rate limiting (10/min per user)                  │   │
│  │  - Authentication & authorization                   │   │
│  │  - Uses user's configured LLM model                 │   │
│  │  - Quality validation                               │   │
│  │  - Telemetry logging                                │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ API Request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              LLM Provider (OpenAI/Anthropic/etc.)           │
│  - Processes enhancement prompt                             │
│  - Returns structured specification                         │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Frontend Component

**File:** `components/prompt-enhance-button.tsx`

The `PromptEnhanceButton` component provides:

- **Visual States:**
  - Default: "Enhance" with wand icon
  - Loading: Animated spinner with "Enhancing..." text
  - Post-enhancement: Shows undo button

- **Features:**
  - Side-by-side diff preview dialog
  - Character count comparison
  - Keyboard shortcut: `Ctrl/Cmd + E`
  - Toast notifications for all states
  - Disabled state when prompt is too short

- **Props Interface:**

```typescript
interface PromptEnhanceButtonProps {
  prompt: string; // Current prompt value
  onEnhance: (enhanced: string) => void; // Callback when applied
  className?: string; // Optional styling
  disabled?: boolean; // Disable interactions
  minLength?: number; // Minimum chars (default: 10)
}
```

### 2. Backend Action

**File:** `convex/actions/enhancePrompt.ts`

The `enhancePrompt` Convex action handles:

- **Input Validation:**
  - Minimum 10 characters
  - Maximum 5000 characters
  - Authentication required

- **Rate Limiting:**
  - 10 requests per minute per user
  - Prevents API abuse

- **Model Selection:**
  - Prioritizes `gpt-4o-mini` for speed
  - Falls back to first available enabled model
  - Uses user's configured credentials

- **Quality Validation:**
  - Checks for empty/short responses
  - Similarity detection (flags if too similar to input)
  - Refusal pattern detection ("I cannot", "I'm sorry", etc.)
  - Length validation (max 8000 chars)

- **Timeout Handling:**
  - 30-second timeout on LLM requests
  - Graceful error messages

### 3. System Prompt

The AI uses a focused system prompt (`PROMPT_ENHANCER_SYSTEM_PROMPT`) that instructs it to:

1. **Clarify intent**: Identify what the user wants to build and why
2. **Add technical context**: Suggest appropriate technologies, architectures, and patterns when relevant
3. **Expand requirements**: Help articulate functional and non-functional needs
4. **Stay grounded**: Only add details that are reasonable inferences from the original input
5. **Be concise**: Enhance without over-explaining

The prompt is intentionally simple and flexible, allowing the LLM to enhance prompts naturally without forcing a rigid output structure.

## API Reference

### Frontend Hook

```typescript
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// In your component:
const enhanceAction = useAction(
  (api as any)["actions/enhancePrompt"]?.enhancePrompt
);

// Call the action:
const result = await enhanceAction({ prompt: "Your description here" });

// Result type:
{
  success: boolean;
  enhancedPrompt?: string;
  originalPrompt?: string;
  error?: string;
  latencyMs?: number;
}
```

### Integration Example

```tsx
import { PromptEnhanceButton } from '@/components/prompt-enhance-button';
import { Textarea } from '@/components/ui/textarea';

function ProjectForm() {
  const [description, setDescription] = useState('');

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <label>Project Description</label>
        <PromptEnhanceButton
          prompt={description}
          onEnhance={setDescription}
          minLength={10}
        />
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </div>
  );
}
```

## Configuration

### Rate Limiting

Rate limits are configured in `convex/rateLimiter.ts`:

```typescript
enhancePrompt: {
  kind: "token bucket",
  period: MINUTE,
  rate: 10,
  capacity: 15,
}
```

### Model Selection

The action uses the user's configured LLM model from settings:

```typescript
// Resolve model using the same pattern as generatePhase
// This ensures we use the user's configured model
let model: LlmModel;
if (credentials?.modelId) {
  model = getModelById(credentials.modelId) ?? getFallbackModel();
} else if (credentials?.provider) {
  // Fallback to first enabled model for provider
  const modelId = getFirstEnabledModelForProvider(
    credentials.provider,
    enabledModels,
  );
  model = getModelById(modelId) ?? getFallbackModel();
} else {
  model = getFallbackModel();
}
```

The prompt enhancement feature inherits the active model configuration from the user's settings, ensuring consistency with other AI-powered features in the application.

### Timeout Settings

The timeout uses the shared `LLM_DEFAULTS.API_TIMEOUT_MS` constant (120 seconds) for LLM requests, consistent with other AI operations in the application:

```typescript
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';

const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(
    () => reject(new Error('Request timeout')),
    LLM_DEFAULTS.API_TIMEOUT_MS,
  );
});
```

This extended timeout supports slower reasoning models and providers with higher latency.

## Files Created/Modified

### New Files

1. **`convex/actions/enhancePrompt.ts`** - Backend action for prompt enhancement
2. **`components/prompt-enhance-button.tsx`** - Frontend button component
3. **`components/__tests__/prompt-enhance-button.test.tsx`** - Unit tests

### Modified Files

1. **`convex/rateLimiter.ts`** - Added `enhancePrompt` rate limit configuration
2. **`app/(auth)/dashboard/new/page.tsx`** - Integrated button into project creation form

## Error Handling

### Common Errors

| Error                     | Cause                 | Solution                       |
| ------------------------- | --------------------- | ------------------------------ |
| "Prompt too short"        | < 10 characters       | Write a longer description     |
| "Prompt too long"         | > 5000 characters     | Shorten your description       |
| "Rate limit exceeded"     | > 10 req/min          | Wait a minute and retry        |
| "Enhancement timed out"   | API slow/unresponsive | Retry or check API status      |
| "Quality check failed"    | Output too similar    | Rephrase your description      |
| "No LLM models available" | No enabled models     | Configure AI model in settings |
| "No API credentials"      | Missing API key       | Add API key in settings        |

### Telemetry

All operations are logged for monitoring:

```typescript
logTelemetry('info', {
  provider: 'openai',
  model: 'gpt-4o-mini',
  durationMs: 2450,
  success: true,
  tokens: { prompt: 1500, completion: 800, total: 2300 },
});
```

Check your console/logs to debug issues.

## Testing

### Unit Tests

```bash
npm run test -- components/__tests__/prompt-enhance-button.test.tsx
```

Tests cover:

- Rendering with different states
- Button enable/disable logic
- Props validation
- Custom className application
- Keyboard shortcuts

### Manual Testing

1. Navigate to `/dashboard/new`
2. Enter a brief description (e.g., "Build a todo app")
3. Click "Enhance" button
4. Review the preview dialog
5. Click "Apply Enhancement"
6. Try the undo functionality
7. Test keyboard shortcut: `Ctrl/Cmd + E`

## Performance Considerations

- **Latency:** Target < 3 seconds for typical inputs
- **Token Usage:** ~1,500-2,500 tokens per enhancement
- **Cost:** Uses gpt-4o-mini (cheaper than GPT-4o)
- **Rate Limiting:** Prevents abuse and controls costs

## Future Enhancements

Potential improvements:

1. **Streaming:** Show enhancement progress in real-time
2. **History:** Track previous enhancements for comparison
3. **Templates:** Pre-defined enhancement styles (technical, business, creative)
4. **Multi-language:** Enhance in user's preferred language
5. **A/B Testing:** Compare different enhancement strategies

## Troubleshooting

### Timeout Issues

If you frequently get timeout errors:

1. Check your internet connection
2. Verify API key is valid in settings
3. Try a shorter description
4. Check LLM provider status page
5. Increase timeout in `enhancePrompt.ts` if needed

### Quality Issues

If enhancements are not helpful:

1. Provide more context in your description
2. Be specific about technical requirements
3. Mention target users and use cases
4. Try rephrasing with different terminology

## Security

- API keys are stored encrypted in Convex
- No prompt content is persisted
- Rate limiting prevents abuse
- Authentication required for all requests
- Input sanitization prevents injection attacks

---

**Last Updated:** 2026-02-17  
**Version:** 1.0.0  
**Maintainer:** SpecForge Team
