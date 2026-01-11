'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  FALLBACK_MODELS,
  getSectionPlan,
  planSections,
  mergeSectionContent,
  estimateTokenCount,
} from '../../lib/llm/chunking';
import {
  getModelById,
  getFallbackModel,
  validateModelForArtifact,
  resolveCredentials,
} from '../../lib/llm/registry';
import type { SectionPlan, ProviderCredentials } from '../../lib/llm/types';
import { createOpenAIClient } from '../../lib/llm/providers/openai';
import { createAnthropicClient } from '../../lib/llm/providers/anthropic';
import { createZAIClient } from '../../lib/llm/providers/zai';
import { createMinimaxClient } from '../../lib/llm/providers/minimax';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

// Get the LLM client based on credentials
function getLlmClient(credentials: ProviderCredentials | null) {
  if (!credentials) return null;

  switch (credentials.provider) {
    case 'openai':
      return createOpenAIClient(credentials.apiKey);
    case 'anthropic':
      return createAnthropicClient(credentials.apiKey);
    case 'zai':
      return createZAIClient(
        credentials.apiKey,
        credentials.zaiEndpointType ?? 'paid',
        credentials.zaiIsChina ?? false
      );
    case 'minimax':
      return createMinimaxClient(credentials.apiKey);
    default:
      return null;
  }
}

export const generatePhase = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    modelId: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ artifactId: any; status: string }> => {
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Get phase data with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });

    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    const answeredQuestions = questions.filter((q: Question) => q.answer);

    if (answeredQuestions.length === 0 && args.phaseId !== 'handoff') {
      throw new Error('Please answer at least one question before generating');
    }

    // Get user config to determine if they use system credentials
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
      {}
    );

    // Get system credentials from database (decrypted, only accessible from Convex actions)
    const systemCredentialsMap = await ctx.runAction(
      internalApi.internalActions.getAllDecryptedSystemCredentials,
      {}
    );

    // Resolve credentials (user's own key or system key)
    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {}))
    );

    // Get or select model
    const model = args.modelId
      ? (getModelById(args.modelId) ?? getFallbackModel())
      : getFallbackModel();

    // Validate model for artifact type
    const artifactType =
      args.phaseId === 'brief'
        ? 'prd'
        : args.phaseId === 'handoff'
          ? 'handoff'
          : args.phaseId === 'specs'
            ? 'spec'
            : 'doc';

    const validation = validateModelForArtifact(model, artifactType);
    if (!validation.valid) {
      console.warn(`Model validation warning: ${validation.reason}`);
    }

    // Get section plan based on phase
    const sectionNames = getSectionPlan(artifactType, args.phaseId);
    const sectionPlan = planSections(model, sectionNames, 0.5);

    // Build project context from questions
    const projectContext = {
      title: project.title,
      description: project.description,
      questions: answeredQuestions
        .map((q: Question) => `${q.text}: ${q.answer}`)
        .join('\n\n'),
    };

    // Get LLM client (for future use when actual API calls are implemented)
    const llmClient = getLlmClient(credentials);
    const providerInfo = credentials
      ? `Using ${credentials.provider} (${credentials.apiKey.slice(0, 8)}...)`
      : 'No credentials configured';

    // Generate sections (simulated - in production, this would call actual LLM APIs)
    const generatedSections = await generateSectionsWithSelfCritique({
      ctx,
      projectId: args.projectId,
      projectContext,
      sectionPlan,
      model,
      questions: answeredQuestions,
      phaseId: args.phaseId,
      llmClient,
      providerInfo,
    });

    // Merge sections into final content
    const content = mergeSectionContent(generatedSections);
    const previewHtml = generatePreviewHtml(content);

    // Calculate section metadata
    const sections = generatedSections.map((section) => ({
      name: section.name,
      tokens: estimateTokenCount(section.content),
      model: model.id,
    }));

    // Create artifact
    const artifactId = await ctx.runMutation(
      internalApi.internal.createArtifact,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
        type: artifactType,
        title: `${args.phaseId.charAt(0).toUpperCase() + args.phaseId.slice(1)} - ${getPhaseTitle(args.phaseId)}`,
        content,
        previewHtml,
        sections,
      }
    );

    // Update phase status
    await ctx.runMutation(internalApi.internal.updatePhaseStatus, {
      projectId: args.projectId,
      phaseId: args.phaseId,
      status: 'ready',
    });

    return { artifactId, status: 'success' };
  },
});

interface GenerateSectionsParams {
  ctx: ActionCtx;
  projectId: any;
  projectContext: {
    title: string;
    description: string;
    questions: string;
  };
  sectionPlan: SectionPlan[];
  model: any;
  questions: Question[];
  phaseId: string;
  llmClient: ReturnType<typeof getLlmClient>;
  providerInfo: string;
}

async function generateSectionsWithSelfCritique(
  params: GenerateSectionsParams
): Promise<Array<{ name: string; content: string }>> {
  const {
    sectionPlan,
    projectContext,
    model,
    questions,
    phaseId,
    llmClient,
    providerInfo,
  } = params;

  const sections: Array<{ name: string; content: string }> = [];

  for (let i = 0; i < sectionPlan.length; i++) {
    const section = sectionPlan[i];
    const previousSections = sections.slice(0, i);
    const sectionQuestions = extractRelevantQuestions(questions, section.name);

    // Generate section content
    const content = await generateSectionContent({
      projectContext,
      sectionName: section.name,
      sectionInstructions: getSectionInstructions(phaseId, section.name),
      sectionQuestions,
      previousSections,
      model,
      maxTokens: section.maxTokens,
      llmClient,
      providerInfo,
    });

    // Self-critique and improve if needed
    const improved = await selfCritiqueSection({
      content,
      sectionName: section.name,
      projectContext,
      model,
      llmClient,
    });

    sections.push({
      name: section.name,
      content: improved,
    });
  }

  return sections;
}

async function generateSectionContent(params: {
  projectContext: { title: string; description: string; questions: string };
  sectionName: string;
  sectionInstructions: string;
  sectionQuestions: string[];
  previousSections: Array<{ name: string; content: string }>;
  model: any;
  maxTokens: number;
  llmClient: ReturnType<typeof getLlmClient>;
  providerInfo: string;
}): Promise<string> {
  // In a real implementation, this would call the actual LLM API
  // For now, we generate placeholder content based on the section

  let content = `# ${formatSectionName(params.sectionName)}\n\n`;

  if (params.sectionQuestions.length > 0) {
    const answers = params.sectionQuestions.map((q) => `- ${q}`).join('\n');
    content += `Based on your responses:\n\n${answers}\n\n`;
  }

  content += `This is the ${params.sectionName} section for **${params.projectContext.title}**.\n\n`;
  content += `**Description:** ${params.projectContext.description}\n\n`;
  content += `**Context from previous sections:**\n`;
  if (params.previousSections.length > 0) {
    content += params.previousSections
      .map((s) => `- ${s.name}: ${s.content.slice(0, 100)}...`)
      .join('\n');
  } else {
    content += 'No previous sections.\n';
  }

  content += `\n\n---\n*Generated with ${params.model.id} via ${params.providerInfo}*\n`;

  return content;
}

async function selfCritiqueSection(params: {
  content: string;
  sectionName: string;
  projectContext: { title: string; description: string };
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  // In production, this would call the LLM to critique and improve the section
  // For now, we perform basic validation and improvements

  let improved = params.content;

  // Basic checks and improvements
  if (improved.length < 100) {
    // Section is too short, add a note
    improved += '\n\n*This section needs additional detail.*';
  }

  // Ensure section ends properly
  if (!improved.trimEnd().endsWith('.')) {
    improved = improved.trimEnd() + '.';
  }

  return improved;
}

function extractRelevantQuestions(
  questions: Question[],
  sectionName: string
): string[] {
  const keywords: Record<string, string[]> = {
    'executive-summary': ['goal', 'problem', 'success'],
    architecture: ['architecture', 'cloud', 'infrastructure'],
    'data-models': ['data', 'database', 'schema'],
    'user-stories': ['user', 'persona', 'feature'],
    deployment: ['deployment', 'environment', 'infrastructure'],
  };

  const relevantKeywords = keywords[sectionName] || [];

  return questions
    .filter(
      (q) =>
        q.answer &&
        relevantKeywords.some((kw) => q.text.toLowerCase().includes(kw))
    )
    .map((q) => `${q.text}: ${q.answer}`);
}

function getSectionInstructions(phaseId: string, sectionName: string): string {
  const instructions: Record<string, string> = {
    'executive-summary':
      'Provide a concise overview of the project goals, target users, and key deliverables.',
    'problem-statement':
      'Clearly articulate the problem this project solves and why it matters.',
    'goals-and-objectives':
      'List specific, measurable goals with success criteria.',
    'user-personas': 'Describe the primary user types and their needs.',
    'key-features': 'Outline the core features and functionality required.',
    'technical-constraints':
      'Note any technical limitations, integrations, or compliance requirements.',
    'success-metrics':
      'Define how success will be measured (KPIs, metrics, benchmarks).',
    timeline: 'Provide estimated milestones and key dates.',
    'architecture-overview':
      'Describe the high-level system architecture and design patterns.',
    'data-models':
      'Define the core data structures, entities, and relationships.',
    'api-specifications': 'Document the API contracts and integration points.',
    'security-requirements':
      'Outline authentication, authorization, and data protection requirements.',
    'performance-requirements':
      'Define latency, throughput, and scalability requirements.',
    'integration-points':
      'List external systems and APIs that need integration.',
    'deployment-strategy':
      'Describe the deployment approach and infrastructure.',
  };

  return (
    instructions[sectionName] ||
    `Generate comprehensive content for the ${sectionName} section.`
  );
}

function formatSectionName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generatePreviewHtml(content: string): string {
  // Simple markdown to HTML conversion for preview
  return content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function getPhaseTitle(phaseId: string): string {
  const titles: Record<string, string> = {
    brief: 'Product Requirements Document',
    specs: 'Technical Specifications',
    stories: 'User Stories & Tasks',
    artifacts: 'Technical Artifacts',
    handoff: 'Project Handoff',
  };
  return titles[phaseId] || 'Document';
}
