import type { LlmSectionRequest } from './types';
import { getCapabilities, type PromptCapabilities } from './provider-capabilities';

/**
 * Transforms a generic LlmSectionRequest into provider-optimized prompts.
 * Uses capability-based system for deep model agnosticism.
 */
export function buildTransformedPrompts(
  request: LlmSectionRequest,
  provider: string,
): { systemPrompt: string; userPrompt: string } {
  const caps = getCapabilities(provider);

  const prevSectionsStr =
    request.previousSections.length > 0
      ? request.previousSections
          .map((s) => `## ${s.name}\n${s.content}`)
          .join('\n\n')
      : 'No previous sections.';

  const sectionInstStr =
    request.sectionInstructions ||
    'Generate comprehensive, detailed content for this section.';

  const questionsStr =
    request.sectionQuestions.length > 0
      ? `Answer these questions based on the project context:\n${request.sectionQuestions.map((q) => `- ${q}`).join('\n')}`
      : '';

  // Build system prompt based on capabilities
  const systemPrompt = buildSystemPrompt(caps, {
    artifactType: request.artifactType,
    sectionName: request.sectionName,
    prevSectionsStr,
    sectionInstStr,
  });

  // Build user prompt based on capabilities
  const userPrompt = buildUserPrompt(caps, {
    sectionName: request.sectionName,
    artifactType: request.artifactType,
    projectTitle: request.projectContext.title,
    projectDescription: request.projectContext.description,
    questionsStr,
  });

  return { systemPrompt, userPrompt };
}

interface SystemPromptParams {
  artifactType: string;
  sectionName: string;
  prevSectionsStr: string;
  sectionInstStr: string;
}

function buildSystemPrompt(
  caps: PromptCapabilities,
  params: SystemPromptParams,
): string {
  const { artifactType, sectionName, prevSectionsStr, sectionInstStr } = params;

  if (caps.supportsXmlTags && caps.contextFormat === 'xml') {
    // XML format for Anthropic
    return `<role>
You are an expert technical writer creating a ${artifactType} document.
Your task is to generate the "${sectionName}" section.
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
  }

  if (caps.prefersMarkdownStructure) {
    // Markdown headers for providers that prefer structure
    return `You are an expert technical writer creating a ${artifactType} document.
Your task is to generate the "${sectionName}" section.

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
  }

  // Default format
  return `You are an expert technical writer creating a ${artifactType} document.
Your task is to generate the "${sectionName}" section.

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

interface UserPromptParams {
  sectionName: string;
  artifactType: string;
  projectTitle: string;
  projectDescription: string;
  questionsStr: string;
}

function buildUserPrompt(
  caps: PromptCapabilities,
  params: UserPromptParams,
): string {
  const { sectionName, artifactType, projectTitle, projectDescription, questionsStr } = params;

  if (caps.supportsXmlTags) {
    // XML format for Anthropic
    return `Please generate the "${sectionName}" section for this ${artifactType}.

<project>
Title: ${projectTitle}
Description: ${projectDescription}
</project>

${questionsStr}

Generate the section now. Be comprehensive and detailed.`;
  }

  // Default format
  return `Please generate the "${sectionName}" section for this ${artifactType}.

Project: ${projectTitle}
Description: ${projectDescription}

${questionsStr}

Generate the section now:`;
}
