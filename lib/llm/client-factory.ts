import { createOpenAIClient } from './providers/openai';
import { createOpenRouterClient } from './providers/openrouter';
import { createDeepSeekClient } from './providers/deepseek';
import { createAnthropicClient } from './providers/anthropic';
import { createMistralClient } from './providers/mistral';
import { createZAIClient } from './providers/zai';
import { createMinimaxClient } from './providers/minimax';
import { 
  createGenericOpenAIClient, 
  getProviderBaseUrl 
} from './providers/generic-openai';
import type { ProviderCredentials, LlmProvider } from './types';

export function createLlmClient(
  credentials: ProviderCredentials | null,
  providerApiEndpoint?: string | null
): LlmProvider | null {
  if (!credentials || !credentials.apiKey) {
    console.warn('[createLlmClient] No credentials provided');
    return null;
  }

  const provider = credentials.provider;
  
  // Use provided API endpoint from models.dev, or fall back to hardcoded
  const baseUrl = providerApiEndpoint || getProviderBaseUrl(provider);

  switch (provider) {
    case 'openai':
      return createOpenAIClient(credentials.apiKey);
    case 'openrouter':
      return createOpenRouterClient(credentials.apiKey);
    case 'deepseek':
      return createDeepSeekClient(credentials.apiKey);
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
      // Use generic OpenAI-compatible client with the correct base URL
      if (baseUrl) {
        console.log(
          `[createLlmClient] Using generic OpenAI client for ${provider} at ${baseUrl}`
        );
        return createGenericOpenAIClient(
          credentials.apiKey,
          baseUrl,
          provider
        );
      }
      
      console.warn(
        `[createLlmClient] Unsupported provider: ${provider}. ` +
        `No API endpoint configured.`
      );
      return null;
  }
}
