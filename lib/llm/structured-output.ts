import type { ZodSchema } from 'zod';

export type StructuredOutputMode =
  | { type: 'json_schema'; schema: object } // OpenAI native
  | { type: 'tool_use'; toolName: string; schema: object } // Anthropic
  | { type: 'json_object' } // Weak JSON mode
  | { type: 'none' }; // Regex fallback

/**
 * Returns the best structured output mode for a given provider.
 * Falls back gracefully: native schema → json_object → regex.
 */
export function getStructuredOutputMode(
  provider: string,
  jsonSchema: object,
): StructuredOutputMode {
  switch (provider) {
    case 'openai':
      return {
        type: 'json_schema',
        schema: jsonSchema,
      };
    case 'anthropic':
      return {
        type: 'tool_use',
        toolName: 'extract_structured_data',
        schema: jsonSchema,
      };
    case 'deepseek':
    case 'mistral':
      return { type: 'json_object' };
    default:
      return { type: 'none' };
  }
}

/**
 * Applies structured output parameters to a request body.
 */
export function applyStructuredOutput(
  requestBody: Record<string, unknown>,
  mode: StructuredOutputMode,
): Record<string, unknown> {
  switch (mode.type) {
    case 'json_schema':
      return {
        ...requestBody,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: true,
            schema: mode.schema,
          },
        },
      };
    case 'tool_use':
      return {
        ...requestBody,
        tools: [
          {
            name: mode.toolName,
            description: 'Extract structured data from the content',
            input_schema: mode.schema,
          },
        ],
        tool_choice: { type: 'tool', name: mode.toolName },
      };
    case 'json_object':
      return {
        ...requestBody,
        response_format: { type: 'json_object' },
      };
    default:
      return requestBody;
  }
}

/**
 * Extracts JSON from a response based on the structured output mode used.
 */
export function extractJsonFromResponse(
  response: string,
  mode: StructuredOutputMode,
): string {
  if (mode.type === 'none') {
    // Fall back to regex extraction
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    return jsonMatch ? jsonMatch[1].trim() : response.trim();
  }

  // For native structured output modes, the response should already be JSON
  return response.trim();
}
