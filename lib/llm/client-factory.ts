import { createOpenAIClient } from './providers/openai';
import { createAnthropicClient } from './providers/anthropic';
import { createMistralClient } from './providers/mistral';
import { createZAIClient } from './providers/zai';
import { createMinimaxClient } from './providers/minimax';
import type { ProviderCredentials, LlmProvider } from './types';

export function createLlmClient(
  credentials: ProviderCredentials | null
): LlmProvider | null {
  if (!credentials || !credentials.apiKey) {
    return null;
  }

  switch (credentials.provider) {
    case 'openai':
      return createOpenAIClient(credentials.apiKey);
    case 'anthropic':
      return createAnthropicClient(credentials.apiKey);
    case 'mistral':
      return createMistralClient(credentials.apiKey);
    case 'zai':
      return createZAIClient(
        credentials.apiKey,
        credentials.zaiEndpointType ?? 'paid',
        credentials.zaiIsChina ?? false
      );
    case 'minimax':
      return createMinimaxClient(credentials.apiKey);
    default:
      console.warn(
        `[createLlmClient] Unsupported provider: ${credentials.provider}`
      );
      return null;
  }
}
