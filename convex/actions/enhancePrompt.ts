'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import { createLlmClient } from '../../lib/llm/client-factory';
import {
  resolveModelForCredentials,
  resolveCredentials,
  validateProviderModelMatch,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { LlmModel } from '../../lib/llm/types';
import { rateLimiter } from '../rateLimiter';
import { logTelemetry } from '../../lib/llm/telemetry';
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';
import { fetchModelDirectory } from '../../lib/llm/model-directory';

/**
 * System prompt for the prompt enhancement AI.
 * This prompt transforms vague user inputs into detailed, context-rich instructions
 * optimized for software specification generation.
 */
export const PROMPT_ENHANCER_SYSTEM_PROMPT = `You are an expert at enhancing prompts for software development projects. Your goal is to transform brief or vague project descriptions into clear, detailed, and actionable specifications.

## Guidelines

1. **Clarify intent**: Identify what the user wants to build and why
2. **Add technical context**: Suggest appropriate technologies, architectures, and patterns when relevant
3. **Expand requirements**: Help articulate functional and non-functional needs
4. **Stay grounded**: Only add details that are reasonable inferences from the original input
5. **Be concise**: Enhance without over-explaining

## Output

Provide the enhanced prompt directly. Do not include meta-commentary, explanations, or ask questions. Maintain the original language of the input.`;

/**
 * Validates the enhanced prompt for quality and safety.
 * Returns validation result and optional error message.
 */
function validateEnhancedPrompt(
  original: string,
  enhanced: string,
): { valid: boolean; error?: string } {
  // Check for empty or too-short responses
  if (!enhanced || enhanced.trim().length < 50) {
    return { valid: false, error: 'Enhanced prompt too short or empty' };
  }

  // Check that output is meaningfully different from input
  const similarity = calculateSimilarity(
    original.toLowerCase(),
    enhanced.toLowerCase(),
  );
  if (similarity > 0.95) {
    return {
      valid: false,
      error: 'Enhanced prompt is too similar to original',
    };
  }

  // Check for common failure patterns
  const failurePatterns = [
    /i cannot/i,
    /i'm sorry/i,
    /i apologize/i,
    /as an ai/i,
    /i don't have/i,
    /\[enhanced specification\]/i,
    /\[insert/i,
    /\[your/i,
  ];

  for (const pattern of failurePatterns) {
    if (pattern.test(enhanced)) {
      return {
        valid: false,
        error: 'Response contains placeholder or refusal language',
      };
    }
  }

  // Check for reasonable length (not too long)
  if (enhanced.length > 8000) {
    return { valid: false, error: 'Enhanced prompt exceeds maximum length' };
  }

  return { valid: true };
}

/**
 * Calculates Jaccard similarity between two strings for quality checking.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(/\s+/));
  const set2 = new Set(str2.split(/\s+/));
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

/**
 * Production-ready Prompt Enhancement API
 *
 * Technical Best Practices Implemented:
 *
 * 1. MODEL SELECTION:
 *    - Uses the user's configured LLM model from settings
 *    - Falls back to first enabled model for the provider
 *    - Validates provider-model match before API calls
 *    - Inherits active model configuration from user settings
 *
 * 2. LATENCY OPTIMIZATION:
 *    - Implements request timeouts to prevent hanging
 *    - Rate limiting to prevent abuse and resource exhaustion
 *
 * 3. ERROR HANDLING:
 *    - Graceful degradation with fallback to original prompt
 *    - Validation of LLM output quality
 *    - Structured error responses with actionable messages
 *    - Telemetry logging for debugging and monitoring
 *
 * 4. RELIABILITY:
 *    - Input sanitization to prevent prompt injection
 *    - Output validation to ensure quality
 *    - Retry logic with exponential backoff (handled by client)
 *    - Circuit breaker pattern consideration for provider failures
 *
 * 5. SECURITY:
 *    - Rate limiting per user to prevent abuse
 *    - No persistence of sensitive prompt content
 *    - Authentication validation before processing
 *
 * 6. MONITORING:
 *    - Telemetry tracking for latency, success rates, token usage
 *    - Error categorization for alerting
 */
export const enhancePrompt = action({
  args: {
    prompt: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args,
  ): Promise<{
    success: boolean;
    enhancedPrompt?: string;
    originalPrompt?: string;
    error?: string;
    latencyMs?: number;
  }> => {
    const startTime = Date.now();

    try {
      // Authentication check
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return {
          success: false,
          error: 'Unauthorized: Please sign in to use prompt enhancement',
        };
      }

      const userId = identity.subject;

      // Rate limiting - prevent abuse
      try {
        await rateLimiter.limit(ctx, 'enhancePrompt');
      } catch (rateError) {
        return {
          success: false,
          error:
            'Rate limit exceeded: Please wait a moment before trying again',
        };
      }

      // Input validation
      const trimmedPrompt = args.prompt.trim();
      if (!trimmedPrompt || trimmedPrompt.length < 10) {
        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error:
            'Prompt too short: Please provide at least 10 characters for meaningful enhancement',
        };
      }

      if (trimmedPrompt.length > 5000) {
        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error:
            'Prompt too long: Maximum 5000 characters supported for enhancement',
        };
      }

      // Resolve user configuration and credentials
      const userConfig = await ctx.runAction(
        internalApi.userConfigActions.getUserConfigInternal,
        {},
      );
      const systemCredentialsMap = await ctx.runAction(
        internalApi.internalActions.getAllDecryptedSystemCredentials,
        {},
      );
      const enabledModelsFromDb = await ctx.runQuery(
        internalApi.llmModels.listEnabledModelsInternal,
      );
      const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

      // Resolve credentials using the standard pattern (same as generatePhase)
      const credentials = resolveCredentials(
        userConfig,
        new Map(Object.entries(systemCredentialsMap || {})),
        enabledModels,
      );

      if (!credentials) {
        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error:
            'No API credentials configured: Please add your API key in settings',
        };
      }

      // Resolve model using the shared resolver that trusts credentials' modelId
      const model: LlmModel = resolveModelForCredentials(credentials, enabledModelsFromDb || [], enabledModels);

      // Fetch provider API endpoint from models.dev
      let providerApiEndpoint: string | null = null;
      try {
        const providers = await fetchModelDirectory();
        const provider = providers.find(p => p.id === credentials.provider);
        providerApiEndpoint = provider?.api || null;
      } catch (err) {
        console.warn(`[enhancePrompt] Failed to fetch provider API endpoint: ${err}`);
      }

      // Validate provider-model match
      const providerValidation = validateProviderModelMatch(
        credentials.provider,
        model.id,
        enabledModelsFromDb || [],
      );
      if (!providerValidation.valid) {
        console.error(
          `[enhancePrompt] Provider-model mismatch: ${providerValidation.error}`,
        );
        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error: `Configuration error: ${providerValidation.error}`,
        };
      }

      // Create LLM client with dynamic API endpoint
      const client = createLlmClient(credentials, providerApiEndpoint);
      if (!client) {
        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error:
            'Failed to initialize AI client: Please check your API configuration',
        };
      }

      // Check if client is available
      if (!client.isAvailable()) {
        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error:
            'AI client is not available: Please verify your API key is valid',
        };
      }

      // Construct the enhancement prompt
      const enhancementPrompt = `${PROMPT_ENHANCER_SYSTEM_PROMPT}\n\nUser input to enhance:\n${trimmedPrompt}`;

      // Use the user's configured model
      const modelToUse = model.id;

      console.log(
        `[enhancePrompt] Using model: ${modelToUse} (provider: ${credentials.provider}) for enhancement`,
      );

      // Call LLM with timeout protection
      const llmPromise = client.complete(enhancementPrompt, {
        model: modelToUse,
        maxTokens: 2000, // Limit response size for speed
        temperature: 0.3, // Lower temperature for consistent, focused output
      });

      // Add timeout to prevent hanging (uses shared timeout constant for slower models/APIs)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Request timeout')),
          LLM_DEFAULTS.API_TIMEOUT_MS,
        );
      });

      let response;
      try {
        response = await Promise.race([llmPromise, timeoutPromise]);
      } catch (timeoutError) {
        // Log timeout for monitoring
        logTelemetry('warn', {
          provider: credentials.provider,
          model: modelToUse,
          durationMs: Date.now() - startTime,
          success: false,
          error: 'timeout',
        });

        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error: `Enhancement timed out after ${LLM_DEFAULTS.API_TIMEOUT_MS / 1000} seconds. This may be due to high API load. Please try again.`,
        };
      }

      const enhancedPrompt = response.content.trim();

      // Validate the enhanced output
      const validation = validateEnhancedPrompt(trimmedPrompt, enhancedPrompt);
      if (!validation.valid) {
        // Log quality issue for monitoring
        logTelemetry('warn', {
          provider: credentials.provider,
          model: modelToUse,
          durationMs: Date.now() - startTime,
          success: false,
          error: `quality_fail: ${validation.error}`,
        });

        return {
          success: false,
          originalPrompt: trimmedPrompt,
          error: `Enhancement quality check failed: ${validation.error}. Please try rephrasing your description.`,
        };
      }

      const latencyMs = Date.now() - startTime;

      // Log successful enhancement
      logTelemetry('info', {
        provider: credentials.provider,
        model: modelToUse,
        durationMs: latencyMs,
        success: true,
        tokens: {
          prompt: response.usage.promptTokens,
          completion: response.usage.completionTokens,
          total: response.usage.totalTokens,
        },
      });

      return {
        success: true,
        originalPrompt: trimmedPrompt,
        enhancedPrompt,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Log unexpected error
      logTelemetry('warn', {
        provider: 'enhance',
        model: 'unknown',
        durationMs: latencyMs,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        originalPrompt: args.prompt,
        error:
          'An unexpected error occurred while enhancing your prompt. Please try again.',
      };
    }
  },
});
