import { describe, it, expect } from 'vitest';
import {
  getCapabilities,
  hasCapability,
  PROVIDER_CAPABILITIES,
} from '../provider-capabilities';

describe('provider-capabilities', () => {
  describe('getCapabilities', () => {
    it('should return capabilities for known providers', () => {
      const anthropicCaps = getCapabilities('anthropic');
      expect(anthropicCaps.supportsXmlTags).toBe(true);
      expect(anthropicCaps.contextFormat).toBe('xml');
      expect(anthropicCaps.maxSystemPromptTokens).toBe(4096);

      const openaiCaps = getCapabilities('openai');
      expect(openaiCaps.supportsXmlTags).toBe(false);
      expect(openaiCaps.prefersMarkdownStructure).toBe(true);
      expect(openaiCaps.maxSystemPromptTokens).toBe(8192);
    });

    it('should return OpenAI capabilities as fallback for unknown providers', () => {
      const unknownCaps = getCapabilities('unknown_provider');
      expect(unknownCaps).toEqual(getCapabilities('openai'));
    });
  });

  describe('hasCapability', () => {
    it('should return true for supported capabilities', () => {
      expect(hasCapability('anthropic', 'supportsXmlTags')).toBe(true);
      expect(hasCapability('openai', 'supportsSystemRole')).toBe(true);
      expect(hasCapability('deepseek', 'supportsChainOfThought')).toBe(true);
    });

    it('should return false for unsupported capabilities', () => {
      expect(hasCapability('openai', 'supportsXmlTags')).toBe(false);
      expect(hasCapability('minimax', 'supportsChainOfThought')).toBe(false);
    });

    it('should fallback to OpenAI for unknown providers', () => {
      expect(hasCapability('unknown', 'supportsSystemRole')).toBe(true);
    });
  });

  describe('PROVIDER_CAPABILITIES', () => {
    it('should define capabilities for all major providers', () => {
      const expectedProviders = [
        'anthropic',
        'openai',
        'zai',
        'deepseek',
        'minimax',
        'mistral',
        'openrouter',
      ];

      for (const provider of expectedProviders) {
        expect(PROVIDER_CAPABILITIES[provider]).toBeDefined();
        expect(PROVIDER_CAPABILITIES[provider].contextFormat).toBeDefined();
        expect(PROVIDER_CAPABILITIES[provider].maxSystemPromptTokens).toBeGreaterThan(0);
      }
    });

    it('should have consistent capability structure', () => {
      for (const [provider, caps] of Object.entries(PROVIDER_CAPABILITIES)) {
        expect(caps.supportsXmlTags).toBeTypeOf('boolean');
        expect(caps.supportsSystemRole).toBeTypeOf('boolean');
        expect(caps.prefersMarkdownStructure).toBeTypeOf('boolean');
        expect(caps.supportsChainOfThought).toBeTypeOf('boolean');
        expect(['xml', 'markdown', 'plaintext']).toContain(caps.contextFormat);
        expect(caps.maxSystemPromptTokens).toBeTypeOf('number');
      }
    });
  });
});
