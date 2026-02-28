/**
 * Provider Capabilities Registry
 * 
 * Defines the prompting capabilities of each LLM provider.
 * Used by the adaptive prompt transformer to build optimal prompts.
 */

export interface PromptCapabilities {
  supportsXmlTags: boolean;
  supportsSystemRole: boolean;
  prefersMarkdownStructure: boolean;
  supportsChainOfThought: boolean;
  contextFormat: 'xml' | 'markdown' | 'plaintext';
  maxSystemPromptTokens: number;
}

export const PROVIDER_CAPABILITIES: Record<string, PromptCapabilities> = {
  anthropic: {
    supportsXmlTags: true,
    supportsSystemRole: true,
    prefersMarkdownStructure: false,
    supportsChainOfThought: true,
    contextFormat: 'xml',
    maxSystemPromptTokens: 4096,
  },
  openai: {
    supportsXmlTags: false,
    supportsSystemRole: true,
    prefersMarkdownStructure: true,
    supportsChainOfThought: true,
    contextFormat: 'markdown',
    maxSystemPromptTokens: 8192,
  },
  zai: {
    supportsXmlTags: false,
    supportsSystemRole: true,
    prefersMarkdownStructure: true,
    supportsChainOfThought: true,
    contextFormat: 'markdown',
    maxSystemPromptTokens: 4096,
  },
  deepseek: {
    supportsXmlTags: false,
    supportsSystemRole: true,
    prefersMarkdownStructure: true,
    supportsChainOfThought: true,
    contextFormat: 'markdown',
    maxSystemPromptTokens: 4096,
  },
  minimax: {
    supportsXmlTags: false,
    supportsSystemRole: true,
    prefersMarkdownStructure: true,
    supportsChainOfThought: false,
    contextFormat: 'markdown',
    maxSystemPromptTokens: 4096,
  },
  mistral: {
    supportsXmlTags: false,
    supportsSystemRole: true,
    prefersMarkdownStructure: true,
    supportsChainOfThought: true,
    contextFormat: 'markdown',
    maxSystemPromptTokens: 4096,
  },
  openrouter: {
    supportsXmlTags: false,
    supportsSystemRole: true,
    prefersMarkdownStructure: true,
    supportsChainOfThought: true,
    contextFormat: 'markdown',
    maxSystemPromptTokens: 4096,
  },
};

/**
 * Gets the capabilities for a provider.
 * Falls back to OpenAI capabilities if provider is unknown.
 */
export function getCapabilities(provider: string): PromptCapabilities {
  return PROVIDER_CAPABILITIES[provider] ?? PROVIDER_CAPABILITIES.openai;
}

/**
 * Checks if a provider supports a specific capability.
 */
export function hasCapability(
  provider: string,
  capability: keyof PromptCapabilities,
): boolean {
  const caps = getCapabilities(provider);
  return Boolean(caps[capability]);
}
