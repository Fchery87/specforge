import type { LlmSectionRequest } from './types';

/**
 * Transforms a generic LlmSectionRequest into provider-optimized prompts.
 * Promotes deep model agnosticism by centralizing the prompting logic
 * and tailoring formats (e.g., XML for Anthropic, Markdown for OpenAI)
 * for the highest quality generations.
 */
export function buildTransformedPrompts(
  request: LlmSectionRequest,
  provider: string,
): { systemPrompt: string; userPrompt: string } {
  const isAnthropic = provider === 'anthropic';
  const isDeepSeek = provider === 'deepseek';
  const isMinimax = provider === 'minimax';

  let systemPrompt = '';
  let userPrompt = '';

  const prevSectionsStr =
    request.previousSections.length > 0
      ? request.previousSections
          .map((s) => `## ${s.name}\n${s.content}`)
          .join('\n\n')
      : 'No previous sections.';

  const sectionInstStr =
    request.sectionInstructions ||
    'Generate comprehensive, detailed content for this section.';

  if (isAnthropic) {
    // Anthropic models perform best with XML tags separating context
    systemPrompt = `<role>
You are an expert technical writer creating a ${request.artifactType} document.
Your task is to generate the "${request.sectionName}" section.
</role>

<previous_sections>
${prevSectionsStr}
</previous_sections>

<requirements>
${sectionInstStr}
</requirements>

<guidelines>
- Use markdown formatting
- Be thorough and detailed
- Include code examples where appropriate
- Maintain consistent style throughout
- Focus on actionable, technical content
</guidelines>`;
  } else if (isDeepSeek || isMinimax) {
    // DeepSeek and Minimax models benefit from clear markdown structure
    // and explicit chain-of-thought directives
    systemPrompt = `You are an expert technical writer creating a ${request.artifactType} document.
Your task is to generate the "${request.sectionName}" section.

# Context from previous sections
${prevSectionsStr}

# Current section requirements
${sectionInstStr}

# Guidelines
- Use markdown formatting
- Be thorough and detailed
- Include code examples where appropriate
- Maintain consistent style throughout
- Focus on actionable, technical content`;
  } else {
    // Standard OpenAI-compatible Markdown format
    systemPrompt = `You are an expert technical writer creating a ${request.artifactType} document.
Your task is to generate the "${request.sectionName}" section.

Context from previous sections:
${prevSectionsStr}

Current section requirements:
${sectionInstStr}

Guidelines:
- Use markdown formatting
- Be thorough and detailed
- Include code examples where appropriate
- Maintain consistent style throughout
- Focus on actionable, technical content`;
  }

  const questionsStr =
    request.sectionQuestions.length > 0
      ? `Answer these questions based on the project context:\n${request.sectionQuestions.map((q) => `- ${q}`).join('\n')}`
      : '';

  if (isAnthropic) {
    userPrompt = `Please generate the "${request.sectionName}" section for this ${request.artifactType}.

<project>
Title: ${request.projectContext.title}
Description: ${request.projectContext.description}
</project>

${questionsStr}

Generate the section now. Be comprehensive and detailed.`;
  } else {
    userPrompt = `Please generate the "${request.sectionName}" section for this ${request.artifactType}.

Project: ${request.projectContext.title}
Description: ${request.projectContext.description}

${questionsStr}

Generate the section now:`;
  }

  return { systemPrompt, userPrompt };
}
