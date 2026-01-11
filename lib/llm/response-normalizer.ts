/**
 * Shared LLM Response Normalizer
 *
 * This utility normalizes API responses from various LLM providers to handle
 * different response formats, including reasoning models that use separate
 * content fields for chain-of-thought and final answers.
 *
 * This applies automatically to all providers that use this utility.
 */

export interface RawApiChoice {
  message?: {
    content?: string | null | Array<{ type: string; text?: string }>;
    reasoning_content?: string;
    role?: string;
    [key: string]: unknown;
  };
  delta?: {
    content?: string;
    [key: string]: unknown;
  };
  text?: string;
  finish_reason?: string;
  index?: number;
  [key: string]: unknown;
}

export interface RawApiResponse {
  choices?: RawApiChoice[];
  content?: Array<{ type?: string; text?: string }>; // Anthropic format
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number; // Anthropic format
    output_tokens?: number; // Anthropic format
  };
  [key: string]: unknown;
}

export interface NormalizedResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Default token limits for question answering operations.
 * Higher than typical to support reasoning models that need more tokens
 * to complete their chain-of-thought before producing final answers.
 */
export const LLM_DEFAULTS = {
  /** Default max tokens for question answering - high to support reasoning models */
  QUESTION_ANSWER_TOKENS: 2000,
  /** Default max tokens for section generation */
  SECTION_GENERATION_TOKENS: 4000,
  /** Default temperature for generation */
  DEFAULT_TEMPERATURE: 0.7,
  /** API request timeout in milliseconds - high to support slow reasoning models */
  API_TIMEOUT_MS: 120000,
} as const;

/**
 * Fetch with timeout support using AbortController.
 * This prevents Convex actions from timing out by ensuring API requests
 * complete within a reasonable time frame.
 *
 * @param url - URL to fetch
 * @param options - Standard fetch options
 * @param timeoutMs - Timeout in milliseconds (default: LLM_DEFAULTS.API_TIMEOUT_MS)
 * @returns Promise<Response>
 * @throws Error if request times out
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = LLM_DEFAULTS.API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(
        `API request timed out after ${timeoutMs / 1000} seconds`
      );
    }
    throw error;
  }
}

/**
 * Extracts content from a choice object, handling various response formats
 * including reasoning models (GLM-4.7, DeepSeek-R1, etc.)
 */
function extractContentFromChoice(choice: RawApiChoice): string {
  // Standard OpenAI-compatible format (preferred - contains final answer)
  if (
    choice.message?.content &&
    typeof choice.message.content === 'string' &&
    choice.message.content.length > 0
  ) {
    return choice.message.content;
  }

  // Reasoning model format (GLM-4.7, DeepSeek-R1, etc.)
  // These models put chain-of-thought in reasoning_content and final answer in content
  // Fall back to reasoning_content if content is empty (model may still be reasoning)
  if (
    choice.message?.reasoning_content &&
    typeof choice.message.reasoning_content === 'string'
  ) {
    return choice.message.reasoning_content;
  }

  // Delta format (sometimes used even in non-streaming responses)
  if (choice.delta?.content && typeof choice.delta.content === 'string') {
    return choice.delta.content;
  }

  // Direct text field (legacy format)
  if (choice.text && typeof choice.text === 'string') {
    return choice.text;
  }

  // Content as array format (multimodal responses)
  if (Array.isArray(choice.message?.content)) {
    return choice.message.content
      .filter(
        (c): c is { type: string; text: string } =>
          c.type === 'text' && typeof c.text === 'string'
      )
      .map((c) => c.text)
      .join('');
  }

  // Dynamic field discovery - try to find any string content in the message object
  if (choice.message) {
    for (const key of Object.keys(choice.message)) {
      const value = choice.message[key];
      if (typeof value === 'string' && value.length > 0 && key !== 'role') {
        return value;
      }
    }
  }

  return '';
}

/**
 * Normalizes an OpenAI-compatible API response to a standard format.
 * Handles various response formats from different providers including:
 * - Standard OpenAI (gpt-4o, etc.)
 * - ZAI/GLM reasoning models (glm-4.7)
 * - Minimax
 * - Any future OpenAI-compatible providers
 */
export function normalizeOpenAIResponse(
  data: RawApiResponse
): NormalizedResponse {
  let content = '';

  if (data.choices?.[0]) {
    content = extractContentFromChoice(data.choices[0]);
  }

  return {
    content,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Normalizes an Anthropic API response to a standard format.
 * Anthropic uses a different response structure with content arrays.
 */
export function normalizeAnthropicResponse(
  data: RawApiResponse
): NormalizedResponse {
  let content = '';

  // Anthropic returns content as an array of content blocks
  if (Array.isArray(data.content)) {
    content = data.content
      .filter(
        (block): block is { type: string; text: string } =>
          block.type === 'text' && typeof block.text === 'string'
      )
      .map((block) => block.text)
      .join('');
  }

  // Anthropic uses input_tokens and output_tokens
  const promptTokens =
    data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0;
  const completionTokens =
    data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0;

  return {
    content,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Auto-detects the response format and normalizes appropriately.
 * Use this when the provider format is unknown or for maximum compatibility.
 */
export function normalizeAnyResponse(data: RawApiResponse): NormalizedResponse {
  // Anthropic format detection (has content array at top level)
  if (Array.isArray(data.content) && !data.choices) {
    return normalizeAnthropicResponse(data);
  }

  // OpenAI-compatible format (default)
  return normalizeOpenAIResponse(data);
}
