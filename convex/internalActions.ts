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
  generateSectionContentStreaming,
  getSectionInstructions,
  generateConstitution,
  generateSectionWithCritique,
  fetchConstitutionForProject,
  isCritiqueEnabled,
} from './actions/generatePhase';
import { CONSTITUTION_PROMPT } from '../lib/llm/prompts/constitution';

// Internal action to get all decrypted system credentials (for use in Convex actions only)
export const getAllDecryptedSystemCredentials = internalAction({
  args: {},
  handler: async (ctx) => {
    const ENCRYPTION_KEY = getRequiredEncryptionKey();

    let configs: any[];
    try {
      configs = (await ctx.runQuery(
        internal.systemCredentials.getAllSystemCredentialsInternal,
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
            `[getAllDecryptedSystemCredentials] Failed to decrypt credential for provider: ${config.provider}`,
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
    const {
      model,
      credentials,
      artifactType,
      projectContext,
      providerApiEndpoint,
      sectionPreferences,
    } = metadata;

    // Create LLM client with dynamic API endpoint from models.dev
    const llmClient = createLlmClient(credentials, providerApiEndpoint);

    // Get custom instructions for this section from preferences (Phase 4 P2)
    const sectionPref = sectionPreferences?.find(
      (p: {
        sectionId: string;
        enabled: boolean;
        customInstructions?: string;
      }) => p.sectionId === section.name,
    );
    const customInstructions = sectionPref?.customInstructions;

    // Build section instructions with custom instructions if provided
    let sectionInstructions = getSectionInstructions(phaseId, section.name);
    if (customInstructions) {
      sectionInstructions = `${sectionInstructions}\n\n## CUSTOM INSTRUCTIONS\n${customInstructions}`;
    }

    try {
      // Initialize streaming state (creates placeholder artifact if missing)
      if (currentStep === 0) {
        await ctx.runMutation(
          internal.internal.setArtifactStreamStatusInternal,
          {
            projectId,
            phaseId,
            streamStatus: 'streaming',
            sectionsCompleted: 0,
            sectionsTotal: task.totalSteps,
            currentSection: section.name,
          },
        );
      } else {
        await ctx.runMutation(
          internal.internal.setArtifactStreamStatusInternal,
          {
            projectId,
            phaseId,
            streamStatus: 'streaming',
            sectionsCompleted: currentStep,
            sectionsTotal: task.totalSteps,
            currentSection: section.name,
          },
        );
      }

      let sectionTokens = 0;
      let bufferedDelta = '';
      let bufferedTokens = 0;
      let lastCancelCheckAt = 0;
      const flushBuffer = async (force: boolean) => {
        if (!force && bufferedTokens < 120 && bufferedDelta.length < 600) {
          return;
        }

        const now = Date.now();
        if (now - lastCancelCheckAt > 1000) {
          lastCancelCheckAt = now;
          const artifact = await ctx.runQuery(
            internal.internal.getArtifactByPhaseInternal,
            { projectId, phaseId },
          );
          if (artifact?.streamStatus === 'cancelled') {
            throw new Error('Generation cancelled');
          }
        }

        const deltaToFlush = bufferedDelta;
        const tokensToFlush = bufferedTokens;
        bufferedDelta = '';
        bufferedTokens = 0;

        await ctx.runMutation(
          internal.internal.appendPartialContentToArtifactInternal,
          {
            projectId,
            phaseId,
            deltaContent: deltaToFlush,
            tokensGeneratedDelta: tokensToFlush,
            recomputePreview: force,
            currentSection: section.name,
            sectionsCompleted: currentStep,
            sectionsTotal: task.totalSteps,
            streamStatus: 'streaming',
          },
        );
      };

      // Check if critique is enabled for this phase
      const critiqueEnabled =
        isCritiqueEnabled() &&
        ['specs', 'techSpec', 'stories', 'artifacts'].includes(phaseId);

      let finalContent: string;
      let critiqueResult:
        | Awaited<ReturnType<typeof generateSectionWithCritique>>
        | undefined;

      if (critiqueEnabled) {
        // Fetch constitution for critique
        const constitution = await fetchConstitutionForProject(ctx, projectId);

        // Use critique-enabled generation (non-streaming for critique)
        console.log(
          `[generatePhaseWorker] Running with critique for section: ${section.name}`,
        );
        critiqueResult = await generateSectionWithCritique({
          projectContext,
          sectionName: section.name,
          sectionInstructions,
          sectionQuestions: [],
          previousSections: [],
          model,
          maxTokens: section.maxTokens,
          llmClient,
          providerInfo: `Worker step ${currentStep + 1}`,
          phaseId,
          constitution,
        });

        finalContent = critiqueResult.content;
        sectionTokens = estimateTokenCount(finalContent);

        // Stream the final content for UI updates
        const chunkSize = 600;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          bufferedDelta += chunk;
          bufferedTokens += estimateTokenCount(chunk);
          await flushBuffer(false);
        }
        await flushBuffer(true);

        // Log critique results
        if (critiqueResult.critique) {
          console.log(
            `[generatePhaseWorker] Critique score: ${critiqueResult.critique.score}/100, passes: ${critiqueResult.critique.passes}`,
          );
          if (critiqueResult.refined) {
            console.log(
              `[generatePhaseWorker] Section was refined based on critique feedback`,
            );
          }
        }
      } else {
        // Use standard streaming generation (no critique)
        const response = await generateSectionContentStreaming({
          projectContext,
          sectionName: section.name,
          sectionInstructions,
          sectionQuestions: [],
          previousSections: [],
          model,
          maxTokens: section.maxTokens,
          chunkMaxTokens: 300,
          maxTurns: 16,
          llmClient,
          providerInfo: `Worker step ${currentStep + 1}`,
          phaseId,
          onChunk: async (delta) => {
            const deltaTokens = estimateTokenCount(delta);
            sectionTokens += deltaTokens;
            bufferedDelta += delta;
            bufferedTokens += deltaTokens;
            await flushBuffer(false);
          },
        });

        finalContent = response.content;
        await flushBuffer(true);
      }

      // Record section metadata at end (content already appended via streaming)
      await ctx.runMutation(
        internal.internal.appendSectionMetadataToArtifactInternal,
        {
          projectId,
          phaseId,
          section: {
            name: section.name,
            tokens: sectionTokens || estimateTokenCount(finalContent),
            model: model.id,
            ...(critiqueResult?.critique && {
              critique: {
                passes: critiqueResult.critique.passes,
                score: critiqueResult.critique.score,
                violations: critiqueResult.critique.violations.slice(0, 5), // Limit stored violations
              },
            }),
          },
        },
      );

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
          { taskId: args.taskId },
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
        await ctx.runMutation(
          internal.internal.setArtifactStreamStatusInternal,
          {
            projectId,
            phaseId,
            streamStatus: 'complete',
            sectionsCompleted: task.totalSteps,
            sectionsTotal: task.totalSteps,
          },
        );

        // Generate Constitution for Brief phase (Phase 1 P0)
        if (phaseId === 'brief') {
          let constitutionSuccess = false;
          let constitutionError: string | undefined;
          
          try {
            console.log(
              '[generatePhaseWorker] Generating Constitution for Brief phase...',
            );

            // Get the generated brief content
            const briefArtifact = await ctx.runQuery(
              internal.internal.getArtifactByPhaseInternal,
              { projectId, phaseId },
            );

            if (briefArtifact && briefArtifact.content) {
              // Use full brief content up to a reasonable limit (12000 chars ~ 3000 tokens)
              // This preserves more context while staying within LLM context limits
              const maxBriefLength = 12000;
              const briefContent =
                briefArtifact.content.length > maxBriefLength
                  ? briefArtifact.content.substring(0, maxBriefLength) +
                    '\n\n[Content truncated for constitution generation...]'
                  : briefArtifact.content;

              const constitutionResult = await generateConstitution({
                ctx,
                projectId,
                projectContext: {
                  title: projectContext.title || 'Project',
                  description: briefContent,
                  questions: '',
                },
                model,
                llmClient,
                providerInfo: providerApiEndpoint || 'default',
              });

              if (constitutionResult.success && constitutionResult.content) {
                // Save constitution as hidden artifact
                await ctx.runMutation(internal.internal.createArtifact, {
                  projectId,
                  phaseId: 'brief', // Store with brief phase
                  type: 'constitution',
                  title: 'Project Constitution',
                  content: constitutionResult.content,
                  previewHtml: renderPreviewHtml(constitutionResult.content),
                  sections: [],
                  isHidden: true,
                });
                constitutionSuccess = true;
                console.log(
                  '[generatePhaseWorker] Constitution generated and saved successfully',
                );
              } else {
                constitutionError = 'Constitution generation returned empty or failed';
                console.warn(
                  `[generatePhaseWorker] ${constitutionError}`,
                );
              }
            } else {
              constitutionError = 'No brief content available for constitution generation';
              console.warn(`[generatePhaseWorker] ${constitutionError}`);
            }
          } catch (error) {
            constitutionError = error instanceof Error ? error.message : String(error);
            console.error(
              '[generatePhaseWorker] Error generating Constitution:',
              constitutionError,
            );
            // Don't fail the whole phase if constitution generation fails
          }
          
          // Store constitution generation status in artifact metadata for visibility
          if (!constitutionSuccess) {
            console.warn(
              `[generatePhaseWorker] Constitution generation failed: ${constitutionError}. ` +
              'Subsequent phases may lack cross-phase consistency.'
            );
          }
        }
      }
    } catch (error: any) {
      console.error(
        `[generatePhaseWorker] Error at step ${currentStep}:`,
        error,
      );

      const isCancelled =
        typeof error?.message === 'string' &&
        error.message.toLowerCase().includes('cancelled');

      await ctx.runMutation(internal.internal.updateGenerationTask, {
        taskId: args.taskId,
        currentStep,
        status: 'failed',
        error: error.message,
      });
      await ctx.runMutation(internal.internal.updatePhaseStatus, {
        projectId,
        phaseId,
        status: isCancelled ? 'ready' : 'error',
      });
      await ctx.runMutation(internal.internal.setArtifactStreamStatusInternal, {
        projectId,
        phaseId,
        streamStatus: isCancelled ? 'cancelled' : 'paused',
        sectionsCompleted: currentStep,
        sectionsTotal: task.totalSteps,
        currentSection: section?.name,
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
    const { model, credentials, projectContext, providerApiEndpoint } =
      metadata;

    // Create LLM client with dynamic API endpoint from models.dev
    const llmClient = createLlmClient(credentials, providerApiEndpoint);

    try {
      const phase = await ctx.runQuery(internal.internal.getPhaseInternal, {
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

      await ctx.runMutation(internal.internal.saveAnswerInternal, {
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
          { taskId: args.taskId },
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
        error,
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
