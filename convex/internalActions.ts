'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { getRequiredEncryptionKey } from '../lib/encryption-key';
import { decrypt } from '../lib/encryption';
import { api, internal } from './_generated/api';
import { createLlmClient } from '../lib/llm/client-factory';
import { renderPreviewHtml } from '../lib/markdown-render';
import { estimateTokenCount } from '../lib/llm/chunking';
import {
  generateSectionContent,
  getSectionInstructions,
} from './actions/generatePhase';

// Internal action to get all decrypted system credentials (for use in Convex actions only)
export const getAllDecryptedSystemCredentials = internalAction({
  args: {},
  handler: async (ctx) => {
    const ENCRYPTION_KEY = getRequiredEncryptionKey();

    let configs: any[];
    try {
      configs = (await ctx.runQuery(
        internal.systemCredentials.getAllSystemCredentialsInternal
      )) as any[];
    } catch {
      return {};
    }

    const credentials: Record<
      string,
      {
        apiKey: string;
        zaiEndpointType?: 'paid' | 'coding';
        zaiIsChina?: boolean;
      }
    > = {};

    for (const config of configs || []) {
      // Skip disabled credentials
      if (!config.isEnabled) {
        continue;
      }

      // Decrypt the API key
      if (config.apiKey) {
        try {
          // Convex bytes() type returns ArrayBuffer - convert to Buffer properly
          let buffer: Buffer;
          if (config.apiKey instanceof ArrayBuffer) {
            buffer = Buffer.from(new Uint8Array(config.apiKey));
          } else if (Buffer.isBuffer(config.apiKey)) {
            buffer = config.apiKey;
          } else {
            buffer = Buffer.from(config.apiKey);
          }

          const jsonString = buffer.toString('utf8');
          const encrypted = JSON.parse(jsonString);
          const decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);

          if (decryptedApiKey) {
            credentials[config.provider] = {
              apiKey: decryptedApiKey,
              zaiEndpointType: config.zaiEndpointType,
              zaiIsChina: config.zaiIsChina,
            };
          }
        } catch {
          // Log error without exposing sensitive data
          console.error(
            `[getAllDecryptedSystemCredentials] Failed to decrypt credential for provider: ${config.provider}`
          );
          continue;
        }
      }
    }

    return credentials;
  },
});

// ============================================================================
// GENERATION WORKERS - Background workers for chained generation
// ============================================================================

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

export const generatePhaseWorker = internalAction({
  args: { taskId: v.id('generationTasks') },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.internal.getGenerationTask, {
      taskId: args.taskId,
    });
    if (!task || task.status !== 'in_progress') return;

    const { currentStep, plan, metadata, projectId, phaseId } = task;
    const section = plan[currentStep];
    const { model, credentials, artifactType, projectContext } = metadata;

    const llmClient = createLlmClient(credentials);

    try {
      const response = await generateSectionContent({
        projectContext,
        sectionName: section.name,
        sectionInstructions: getSectionInstructions(phaseId, section.name),
        sectionQuestions: [],
        previousSections: [],
        model,
        maxTokens: section.maxTokens,
        llmClient,
        providerInfo: `Worker step ${currentStep + 1}`,
        phaseId,
      });

      const previewHtml = renderPreviewHtml(response.content);

      // Append to artifact
      await ctx.runMutation(api.projects.appendSectionToArtifact, {
        projectId,
        phaseId,
        section: {
          name: section.name,
          content: response.content,
          previewHtml,
          tokens: estimateTokenCount(response.content),
          model: model.id,
        },
        isFirst: currentStep === 0,
      });

      const nextStep = currentStep + 1;
      if (nextStep < task.totalSteps) {
        await ctx.runMutation(internal.internal.updateGenerationTask, {
          taskId: args.taskId,
          currentStep: nextStep,
          status: 'in_progress',
        });
        await ctx.scheduler.runAfter(
          0,
          internal.internalActions.generatePhaseWorker,
          { taskId: args.taskId }
        );
      } else {
        await ctx.runMutation(internal.internal.updateGenerationTask, {
          taskId: args.taskId,
          currentStep: nextStep,
          status: 'completed',
        });
        await ctx.runMutation(internal.internal.updatePhaseStatus, {
          projectId,
          phaseId,
          status: 'ready',
        });
      }
    } catch (error: any) {
      console.error(
        `[generatePhaseWorker] Error at step ${currentStep}:`,
        error
      );
      await ctx.runMutation(internal.internal.updateGenerationTask, {
        taskId: args.taskId,
        currentStep,
        status: 'failed',
        error: error.message,
      });
      await ctx.runMutation(internal.internal.updatePhaseStatus, {
        projectId,
        phaseId,
        status: 'error',
      });
    }
  },
});

export const generateQuestionsWorker = internalAction({
  args: { taskId: v.id('generationTasks') },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.internal.getGenerationTask, {
      taskId: args.taskId,
    });
    if (!task || task.status !== 'in_progress') return;

    const { currentStep, plan, metadata, projectId, phaseId } = task;
    const question = plan[currentStep];
    const { model, credentials, projectContext } = metadata;

    const llmClient = createLlmClient(credentials);

    try {
      const phase = await ctx.runQuery(api.projects.getPhase, {
        projectId,
        phaseId,
      });
      const previousAnswers = (phase?.questions || [])
        .filter((q: Question) => q.answer && q.id !== question.id)
        .map((q: Question) => `${q.text}\nAnswer: ${q.answer}`)
        .join('\n\n');

      const prompt = `You are helping answer questions for a software project.

Project Title: ${projectContext.title}
Project Description: ${projectContext.description}

${previousAnswers ? `Previous answers:\n${previousAnswers}\n\n` : ''}

Question: ${question.text}

Provide a clear, concise answer based on the project context and maintain consistency with previous answers. Be specific and actionable.`;

      if (!llmClient) {
        throw new Error('No LLM client available');
      }

      const response = await llmClient.complete(prompt, {
        model: model.id,
        maxTokens: Math.min(model.maxOutputTokens || 2000, 2000),
        temperature: 0.7,
      });

      await ctx.runMutation(api.projects.saveAnswer, {
        projectId,
        phaseId,
        questionId: question.id,
        answer: response.content.trim(),
        aiGenerated: true,
      });

      const nextStep = currentStep + 1;
      if (nextStep < task.totalSteps) {
        await ctx.runMutation(internal.internal.updateGenerationTask, {
          taskId: args.taskId,
          currentStep: nextStep,
          status: 'in_progress',
        });
        await ctx.scheduler.runAfter(
          0,
          internal.internalActions.generateQuestionsWorker,
          { taskId: args.taskId }
        );
      } else {
        await ctx.runMutation(internal.internal.updateGenerationTask, {
          taskId: args.taskId,
          currentStep: nextStep,
          status: 'completed',
        });
      }
    } catch (error: any) {
      console.error(
        `[generateQuestionsWorker] Error at step ${currentStep}:`,
        error
      );
      await ctx.runMutation(internal.internal.updateGenerationTask, {
        taskId: args.taskId,
        currentStep,
        status: 'failed',
        error: error.message,
      });
    }
  },
});
