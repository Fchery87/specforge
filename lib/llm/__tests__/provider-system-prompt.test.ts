// lib/llm/__tests__/provider-system-prompt.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock fetchWithTimeout to use our mock
vi.mock('../response-normalizer', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    fetchWithTimeout: (...args: any[]) => mockFetch(args[0], args[1]),
  };
});

import { OpenAIClient } from '../providers/openai';
import { AnthropicClient } from '../providers/anthropic';
import { DeepSeekClient } from '../providers/deepseek';
import { GenericOpenAIClient } from '../providers/generic-openai';
import type { LlmSectionRequest } from '../types';

const baseSectionRequest: LlmSectionRequest = {
  projectContext: { title: 'Test', description: 'Test project' },
  sectionName: 'Executive Summary',
  sectionQuestions: [],
  previousSections: [],
  artifactType: 'brief',
  modelId: 'gpt-4o',
  maxTokens: 2000,
};

function makeSuccessResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    }),
    text: async () => '',
  };
}

describe('provider generateSection sends systemPrompt separately', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(makeSuccessResponse('Generated content'));
  });

  it('OpenAIClient passes systemPrompt as a system message', async () => {
    const client = new OpenAIClient('test-key');
    await client.generateSection(baseSectionRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const messages = body.messages;

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    // System message should NOT contain the user prompt content
    expect(messages[0].content).not.toContain(messages[1].content);
  });

  it('GenericOpenAIClient passes systemPrompt as a system message', async () => {
    const client = new GenericOpenAIClient('test-key', 'https://api.example.com/v1', 'example');
    await client.generateSection(baseSectionRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const messages = body.messages;

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('AnthropicClient passes system prompt via body.system field', async () => {
    const anthropicRequest = { ...baseSectionRequest, modelId: 'claude-sonnet-4-5' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Generated content' }],
        usage: { input_tokens: 100, output_tokens: 200 },
        stop_reason: 'end_turn',
      }),
      text: async () => '',
    });

    const client = new AnthropicClient('test-key');
    await client.generateSection(anthropicRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.system).toBeDefined();
    expect(typeof body.system).toBe('string');
    expect(body.system.length).toBeGreaterThan(0);
    expect(body.messages.length).toBe(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('DeepSeekClient passes systemPrompt as a system message', async () => {
    const client = new DeepSeekClient('test-key');
    await client.generateSection(baseSectionRequest);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe('system');
  });
});

describe('provider error sanitization', () => {
  it('does not include raw API response in thrown error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: { message: 'Invalid API key', type: 'invalid_request_error', org_id: 'org-SECRET123' },
      }),
    });

    const client = new OpenAIClient('bad-key');
    await expect(
      client.complete('test', { model: 'gpt-4o' })
    ).rejects.toThrow(/OpenAI API error/);

    // The error should NOT contain the org_id
    try {
      await client.complete('test', { model: 'gpt-4o' });
    } catch (e: any) {
      expect(e.message).not.toContain('org-SECRET123');
    }
  });
});
