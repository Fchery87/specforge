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
  detectPrdDrift,
  detectPhaseDrift,
  sanitizeGeneratedContent,
} from './actions/generatePhase';
import { CONSTITUTION_PROMPT } from '../lib/llm/prompts/constitution';
import { ConstitutionSchema } from '../lib/validation/constitution-schema';

/**
 * Heuristic to detect reasoning/thinking models by model ID.
 * These models use internal chain-of-thought and need more output tokens
 * per turn so they can finish thinking AND produce actual content.
 */
function isReasoningModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes('qwq') ||
    id.includes('thinking') ||
    id.includes('deepseek-r1') ||
    id.includes('deepseek-reasoner') ||
    /glm-4\.[7-9]/.test(id) ||
    /glm-[5-9]/.test(id) ||
    /\bo[134]-/.test(id) ||
    id.includes('o1-mini') ||
    id.includes('o1-preview') ||
    id.includes('o3-mini') ||
    id.includes('mimo') ||
    id.includes('hermes-4')
  );
}

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

// Type guard to check if plan item is a section (for artifact generation)
function isSectionPlan(item: {
  name?: string;
  maxTokens?: number;
  sectionType?: string;
  id?: string;
  text?: string;
}): item is { name: string; maxTokens: number; sectionType?: string } {
  return 'name' in item && 'maxTokens' in item;
}

export const generatePhaseWorker = internalAction({
  args: { taskId: v.id('generationTasks') },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.internal.getGenerationTask, {
      taskId: args.taskId,
    });
    if (!task || task.status !== 'in_progress') return;

    const { currentStep, plan, metadata, projectId, phaseId } = task;
    const planItem = plan[currentStep];

    // Type guard: generatePhaseWorker only handles artifact generation (sections)
    if (!isSectionPlan(planItem)) {
      throw new Error(
        'generatePhaseWorker can only process section plans, not question plans',
      );
    }

    // After type guard, we know this is a section plan
    const section = planItem as {
      name: string;
      maxTokens: number;
      sectionType?: string;
    };

    const {
      model,
      credentials,
      artifactType,
      projectContext,
      providerApiEndpoint,
      sectionPreferences,
    } = metadata;

    // Emit context-gathering activity on the first step
    if (currentStep === 0) {
      await ctx.runMutation(internal.internal.appendActivityLog, {
        taskId: task._id,
        entry: { timestamp: Date.now(), message: 'Gathering upstream context...', type: 'context' },
      });
    }

    // Emit activity entry for this section
    await ctx.runMutation(internal.internal.appendActivityLog, {
      taskId: task._id,
      entry: { timestamp: Date.now(), message: `Generating "${section.name}"...`, type: 'generating' },
    });

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

    // Add codebase context if available (Task 19: Codebase Awareness)
    sectionInstructions = await buildSectionInstructionsWithCodebase(
      ctx,
      projectId,
      sectionInstructions,
      phaseId,
    );

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

        // Extract relevant questions for this section from project context
        const sectionQuestions = extractRelevantQuestionsForSection(
          projectContext.questions,
          section.name,
          phaseId,
        );

        // Use critique-enabled generation (non-streaming for critique)
        console.log(
          `[generatePhaseWorker] Running with critique for section: ${section.name}`,
        );
        critiqueResult = await generateSectionWithCritique({
          projectContext,
          sectionName: section.name,
          sectionInstructions,
          sectionQuestions,
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
        // Extract relevant questions for this section from project context
        const sectionQuestions = extractRelevantQuestionsForSection(
          projectContext.questions,
          section.name,
          phaseId,
        );

        const response = await generateSectionContentStreaming({
          projectContext,
          sectionName: section.name,
          sectionInstructions,
          sectionQuestions,
          previousSections: [],
          model,
          maxTokens: section.maxTokens,
          // Reasoning models (QwQ, R1, GLM, etc.) need more tokens per turn
          // so they can finish thinking AND produce actual content.
          // 300 tokens is fine for non-reasoning models but catastrophically
          // small for reasoning models — they exhaust it all on thinking.
          chunkMaxTokens: isReasoningModel(model.id) ? 2000 : 300,
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

      // Post-streaming sanitization: the deltas flushed to the DB are raw.
      // Replace the artifact's content with the sanitized final version.
      // `finalContent` is already sanitized by generateSectionContent[Streaming].
      await ctx.runMutation(internal.internal.sanitizeArtifactContentInternal, {
        projectId,
        phaseId,
        sanitizedContent: sanitizeGeneratedContent(finalContent),
      });

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
        await ctx.runMutation(internal.internal.appendActivityLog, {
          taskId: args.taskId,
          entry: { timestamp: Date.now(), message: 'Generation complete', type: 'complete' },
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

        // Generate JSON Constitution for Constitution phase (Phase 0)
        if (phaseId === 'constitution') {
          let constitutionSuccess = false;
          let constitutionError: string | undefined;

          try {
            console.log(
              '[generatePhaseWorker] Generating JSON Constitution for Constitution phase...',
            );

            // Get the generated constitution content
            const constitutionArtifact = await ctx.runQuery(
              internal.internal.getArtifactByPhaseInternal,
              { projectId, phaseId: 'constitution' },
            );

            // Fetch the actual phase data to get user question answers
            const phaseData = await ctx.runQuery(
              internal.internal.getPhaseInternal,
              {
                projectId,
                phaseId: 'constitution',
              },
            );

            // Build questions text from actual user answers
            const answeredQuestions = (phaseData?.questions || [])
              .filter((q: Question) => q.answer)
              .map((q: Question) => `${q.text}: ${q.answer}`)
              .join('\n');

            if (constitutionArtifact && constitutionArtifact.content) {
              // Use full constitution content up to a reasonable limit
              const maxContentLength = 12000;
              const content =
                constitutionArtifact.content.length > maxContentLength
                  ? constitutionArtifact.content.substring(
                      0,
                      maxContentLength,
                    ) + '\n\n[Content truncated for JSON generation...]'
                  : constitutionArtifact.content;

              const constitutionResult = await generateConstitution({
                ctx,
                projectId,
                projectContext: {
                  title: projectContext.title || 'Project',
                  description: content,
                  questions: answeredQuestions, // PASS ACTUAL USER ANSWERS
                },
                model,
                llmClient,
                providerInfo: providerApiEndpoint || 'default',
              });

              if (constitutionResult.success && constitutionResult.content) {
                // Parse the markdown string to extract potential JSON
                const jsonMatch = constitutionResult.content.match(
                  /```(?:json)?\s*([\s\S]*?)\s*```/,
                );
                const rawContent = jsonMatch
                  ? jsonMatch[1].trim()
                  : constitutionResult.content.trim();

                let parsedConstitution = rawContent;

                try {
                  const jsonObj = JSON.parse(rawContent);
                  ConstitutionSchema.parse(jsonObj);
                  parsedConstitution = JSON.stringify(jsonObj, null, 2);
                  constitutionSuccess = true;
                } catch (err: any) {
                  constitutionError = `Schema validation failed: ${err.message}`;
                  console.warn(
                    '[generatePhaseWorker] Constitution schema validation failed (non-fatal):',
                    err.message,
                  );
                  // Non-fatal: the markdown Constitution artifact is already saved.
                  // JSON version is a best-effort enhancement for downstream phases.
                }

                if (constitutionSuccess) {
                  await ctx.runMutation(internal.internal.createArtifact, {
                    projectId,
                    phaseId: 'constitution',
                    type: 'hidden_constitution',
                    title: 'JSON Constitution',
                    content: `\`\`\`json\n${parsedConstitution}\n\`\`\``,
                    previewHtml: renderPreviewHtml(
                      `\`\`\`json\n${parsedConstitution}\n\`\`\``,
                    ),
                    sections: [],
                    isHidden: true,
                  });
                  console.log(
                    '[generatePhaseWorker] JSON Constitution generated, validated, and saved successfully',
                  );
                }
              } else {
                constitutionError =
                  'Constitution JSON generation returned empty or failed';
                console.warn(`[generatePhaseWorker] ${constitutionError}`);
              }
            } else {
              constitutionError =
                'No constitution markdown content available for JSON generation';
              console.warn(`[generatePhaseWorker] ${constitutionError}`);
            }
          } catch (error) {
            constitutionError =
              error instanceof Error ? error.message : String(error);
            console.warn(
              '[generatePhaseWorker] JSON Constitution generation failed (non-fatal):',
              constitutionError,
            );
            // Never re-throw: Constitution JSON is best-effort.
            // The markdown artifact is already saved and the phase is complete.
          }

          // Store constitution generation status in artifact metadata for visibility
          if (!constitutionSuccess) {
            console.warn(
              `[generatePhaseWorker] JSON Constitution generation failed: ${constitutionError}. ` +
                'Subsequent phases may lack cross-phase consistency.',
            );
          }
        }

        // Living Spec drift detection for all post-constitution phases
        if (!['constitution', 'brief'].includes(phaseId)) {
          try {
            console.log(
              `[generatePhaseWorker] Running drift detection for ${phaseId} phase...`,
            );
            const constitution = await fetchConstitutionForProject(
              ctx,
              projectId,
            );

            if (constitution) {
              // Get the generated artifact content for this phase
              const artifact = await ctx.runQuery(
                internal.internal.getArtifactByPhaseInternal,
                { projectId, phaseId },
              );

              if (artifact?.content) {
                // Use generalized drift detection for all phases
                const driftResult = await detectPhaseDrift({
                  ctx,
                  projectId,
                  phaseId,
                  phaseContent: artifact.content,
                  projectContext,
                  model,
                  llmClient,
                  constitution,
                  featureFlag: true, // Can be disabled via env var to control costs
                });

                // Save drift report to phase
                await ctx.runMutation(internal.internal.saveDriftReport, {
                  projectId,
                  phaseId,
                  driftDetected: driftResult.hasDrift,
                  driftSummary: driftResult.content,
                  comparedAgainst: 'constitution',
                });

                if (driftResult.hasDrift && driftResult.content) {
                  console.log(
                    `[generatePhaseWorker] Drift detected in ${phaseId}. Report saved.`,
                  );
                } else {
                  console.log(
                    `[generatePhaseWorker] No drift detected in ${phaseId}.`,
                  );
                }

                // For handoff phase, also create the legacy Living Spec artifact
                if (phaseId === 'handoff' && driftResult.hasDrift) {
                  await ctx.runMutation(internal.internal.createArtifact, {
                    projectId,
                    phaseId: 'handoff',
                    type: 'handoff',
                    title: 'PRD Update Suggestion (Living Spec)',
                    content: driftResult.content,
                    previewHtml: renderPreviewHtml(driftResult.content),
                    sections: [],
                    isHidden: false,
                  });
                }
              }
            } else {
              console.log(
                '[generatePhaseWorker] No Constitution found for drift detection.',
              );
            }
          } catch (error) {
            console.error(
              `[generatePhaseWorker] Error detecting drift for ${phaseId}:`,
              error,
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

    const { plan, metadata, projectId, phaseId } = task;
    const { model, credentials, projectContext, providerApiEndpoint } =
      metadata;

    // Create LLM client with dynamic API endpoint from models.dev
    const llmClient = createLlmClient(credentials, providerApiEndpoint);
    if (!llmClient) {
      await ctx.runMutation(internal.internal.updateGenerationTask, {
        taskId: args.taskId,
        currentStep: task.currentStep,
        status: 'failed',
        error: 'No LLM client available',
      });
      return;
    }

    try {
      const CONCURRENCY_LIMIT = 3;
      let currentStep = task.currentStep;

      while (currentStep < task.totalSteps) {
        const chunk = plan.slice(currentStep, currentStep + CONCURRENCY_LIMIT);

        await Promise.all(
          chunk.map(async (question: any) => {
            let attempts = 0;
            let success = false;
            let lastError;

            while (attempts < 3 && !success) {
              try {
                const phase = await ctx.runQuery(
                  internal.internal.getPhaseInternal,
                  {
                    projectId,
                    phaseId,
                  },
                );
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
                success = true;
              } catch (err: any) {
                attempts++;
                lastError = err;
                if (
                  err.message?.includes('429') ||
                  err.message?.includes('rate limit')
                ) {
                  // Rate limit, backoff
                  await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * Math.pow(2, attempts)),
                  );
                } else if (attempts >= 3) {
                  throw err; // max retries reached
                }
              }
            }
            if (!success) throw lastError;
          }),
        );

        currentStep += chunk.length;

        // Update task progress after chunk
        await ctx.runMutation(internal.internal.updateGenerationTask, {
          taskId: args.taskId,
          currentStep,
          status: currentStep < task.totalSteps ? 'in_progress' : 'completed',
        });
      }
    } catch (error: any) {
      console.error(`[generateQuestionsWorker] Error:`, error);
      await ctx.runMutation(internal.internal.updateGenerationTask, {
        taskId: args.taskId,
        currentStep: task.currentStep,
        status: 'failed',
        error: error.message,
      });
    }
  },
});

// ============================================================================
// HELPER FUNCTIONS - Data Flow Integration
// ============================================================================

/**
 * Extracts relevant questions for a specific section based on keywords.
 * This ensures user answers flow into the correct artifact sections.
 *
 * @param questionsText - The concatenated questions and answers text from projectContext
 * @param sectionName - The name of the section being generated
 * @param phaseId - The current phase ID
 * @returns Array of relevant question/answer strings
 */
function extractRelevantQuestionsForSection(
  questionsText: string,
  sectionName: string,
  phaseId: string,
): string[] {
  if (!questionsText || questionsText.trim().length === 0) {
    return [];
  }

  // Parse the questions text into individual Q&A pairs
  // Format: "Question text: Answer text\nQuestion text: Answer text"
  const qaPairs = questionsText
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => {
      const colonIndex = line.indexOf(':');
      return {
        question: line.substring(0, colonIndex).trim(),
        answer: line.substring(colonIndex + 1).trim(),
      };
    })
    .filter((qa) => qa.question && qa.answer);

  // Define keywords for each section type
  const sectionKeywords: Record<string, string[]> = {
    // Constitution sections
    'locked-constraints': [
      'constraint',
      'security',
      'invariant',
      'rule',
      'protocol',
      'strict',
      'immutable',
      'non-negotiable',
      'must never',
      'forbidden',
    ],
    'architecture-decisions': [
      'architecture',
      'state',
      'api',
      'pattern',
      'decision',
      'system',
      'design',
      'structure',
      'framework',
      'approach',
    ],
    'tech-stack': [
      'tech',
      'stack',
      'framework',
      'database',
      'language',
      'tool',
      'library',
      'runtime',
      'version',
      'dependency',
      'npm',
      'package',
    ],
    'quality-and-standards': [
      'quality',
      'standard',
      'accessibility',
      'performance',
      'test',
      'wcag',
      'coverage',
      'metric',
      'compliance',
      'audit',
    ],

    // Brief sections
    'problem-and-objectives': [
      'goal',
      'problem',
      'objective',
      'solve',
      'purpose',
      'aim',
      'target',
      'outcome',
      'deliverable',
    ],
    'features-and-requirements': [
      'feature',
      'requirement',
      'constraint',
      'functionality',
      'capability',
      'specification',
      'scope',
      'include',
      'support',
    ],
    'target-audience': [
      'user',
      'audience',
      'customer',
      'stakeholder',
      'persona',
      'target',
      'demographic',
      'market',
      'segment',
    ],

    // PRD sections
    'executive-summary': [
      'summary',
      'overview',
      'brief',
      'high-level',
      'executive',
      'elevator',
    ],
    'problem-statement': [
      'problem',
      'challenge',
      'pain',
      'issue',
      'difficulty',
      'frustration',
      'current state',
      'as-is',
    ],
    'goals-and-objectives': [
      'goal',
      'objective',
      'success',
      'kpi',
      'metric',
      'achieve',
      'measurable',
      'smart',
      'outcome',
    ],
    'user-personas': [
      'persona',
      'user type',
      'role',
      'archetype',
      'user story',
    ],
    requirements: [
      'requirement',
      'functional',
      'non-functional',
      'must',
      'should',
      'shall',
      'needs to',
      'expected to',
    ],
    'success-metrics': [
      'metric',
      'kpi',
      'measure',
      'track',
      'analytics',
      'indicator',
      'success criteria',
      'measurement',
    ],

    // Domain Model sections
    'entity-definitions': [
      'entity',
      'model',
      'domain',
      'object',
      'class',
      'type',
      'data structure',
      'schema',
      'attribute',
      'field',
      'property',
    ],
    'entity-relationships': [
      'relationship',
      'relation',
      'association',
      'connection',
      'link',
      'reference',
      'foreign key',
      'cardinality',
      'one-to',
      'many-to',
    ],
    'state-transitions': [
      'state',
      'transition',
      'lifecycle',
      'status',
      'workflow',
      'stage',
      'process',
      'flow',
      'change',
      'event',
      'trigger',
    ],

    // Specs sections
    'architecture-overview': [
      'architecture',
      'system design',
      'high-level',
      'component',
      'module',
      'layer',
      'tier',
      'service',
      'microservice',
      'monolith',
    ],
    'data-models': [
      'data model',
      'schema',
      'database',
      'entity',
      'table',
      'collection',
      'field',
      'column',
      'type',
      'orm',
      'prisma',
    ],
    'api-design': [
      'api',
      'endpoint',
      'rest',
      'graphql',
      'rpc',
      'request',
      'response',
      'method',
      'route',
      'url',
      'path',
      'resource',
    ],
    'component-architecture': [
      'component',
      'ui',
      'view',
      'screen',
      'page',
      'widget',
      'element',
      'composition',
      'hierarchy',
      'tree',
      'parent',
      'child',
    ],
    'security-considerations': [
      'security',
      'auth',
      'authentication',
      'authorization',
      'permission',
      'role',
      'encrypt',
      'protect',
      'vulnerability',
      'owasp',
      'secure',
    ],
    'deployment-strategy': [
      'deploy',
      'deployment',
      'infrastructure',
      'hosting',
      'platform',
      'vercel',
      'aws',
      'cloud',
      'pipeline',
      'ci/cd',
      'production',
    ],

    // Stories sections
    'epic-overview': [
      'epic',
      'theme',
      'initiative',
      'program',
      'major feature',
    ],
    'user-stories': [
      'story',
      'as a',
      'i want',
      'so that',
      'acceptance',
      'criteria',
      'given',
      'when',
      'then',
    ],
    'technical-tasks': [
      'task',
      'implementation',
      'development',
      'coding',
      'build',
      'create',
      'implement',
      'develop',
      'program',
      'write',
    ],
    'acceptance-criteria': [
      'acceptance',
      'criteria',
      'given',
      'when',
      'then',
      'scenario',
      'test case',
      'validation',
      'verify',
    ],

    // Artifacts sections
    'api-documentation': [
      'documentation',
      'api doc',
      'swagger',
      'openapi',
      'reference',
    ],
    'database-schema': [
      'schema',
      'database',
      'erd',
      'diagram',
      'migration',
      'ddl',
    ],
    'environment-config': [
      'environment',
      'config',
      'variable',
      'env',
      'setting',
      'configuration',
      '.env',
      'secret',
      'credential',
    ],
    'deployment-scripts': [
      'script',
      'deploy',
      'automation',
      'pipeline',
      'github actions',
      'dockerfile',
      'kubernetes',
      'k8s',
      'helm',
    ],

    // Handoff sections
    'project-summary': [
      'summary',
      'overview',
      'introduction',
      'getting started',
      'about',
    ],
    'setup-guide': [
      'setup',
      'install',
      'configure',
      'getting started',
      'prerequisite',
      'requirement',
      'dependency',
      'npm install',
      'clone',
    ],
    'implementation-guide': [
      'implementation',
      'guide',
      'how to',
      'tutorial',
      'step by step',
      'instructions',
      'procedure',
      'process',
    ],
    'next-steps': [
      'next',
      'roadmap',
      'future',
      'upcoming',
      'planned',
      'backlog',
      'milestone',
      'phase',
      'iteration',
    ],
  };

  const keywords = sectionKeywords[sectionName] || [];
  if (keywords.length === 0) {
    // If no specific keywords, return all questions for this phase
    return qaPairs.map((qa) => `${qa.question}: ${qa.answer}`);
  }

  // Score and filter questions based on keyword relevance
  const scoredQuestions = qaPairs.map((qa) => {
    const text = `${qa.question} ${qa.answer}`.toLowerCase();
    const score = keywords.reduce((acc, keyword) => {
      return acc + (text.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);
    return { ...qa, score };
  });

  // Return questions with at least one keyword match, sorted by relevance
  const relevantQuestions = scoredQuestions
    .filter((qa) => qa.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((qa) => `${qa.question}: ${qa.answer}`);

  // If no matches, return all questions (don't lose data)
  if (relevantQuestions.length === 0) {
    return qaPairs.map((qa) => `${qa.question}: ${qa.answer}`);
  }

  return relevantQuestions;
}

// ============================================================================
// CODEBASE CONTEXT (Task 19: Codebase Awareness)
// ============================================================================

interface CodebaseFile {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
}

interface CodebaseData {
  projectId: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  fileTree: string;
  keyFiles: CodebaseFile[];
  analyzedAt: number;
  totalFiles: number;
  totalDirectories: number;
}

/**
 * Fetches codebase data for a project if available
 */
async function fetchCodebaseForProject(
  ctx: any,
  projectId: string,
): Promise<CodebaseData | null> {
  try {
    const codebase = await ctx.runQuery(internal.internal.getCodebaseInternal, {
      projectId,
    });
    return codebase;
  } catch (error) {
    console.warn('[fetchCodebaseForProject] Failed to fetch codebase:', error);
    return null;
  }
}

/**
 * Formats codebase data into a string for inclusion in prompts
 */
function formatCodebaseContext(codebase: CodebaseData): string {
  const lines: string[] = [];

  lines.push('## CONNECTED CODEBASE');
  lines.push(`Repository: ${codebase.repoOwner}/${codebase.repoName}`);
  lines.push(`Branch: ${codebase.defaultBranch}`);
  lines.push(`Files: ${codebase.totalFiles.toLocaleString()} files in ${codebase.totalDirectories.toLocaleString()} directories`);
  lines.push('');

  // Add file tree (truncated if very large)
  lines.push('### Project Structure');
  try {
    const tree = JSON.parse(codebase.fileTree);
    lines.push(formatFileTree(tree, 0));
  } catch {
    lines.push('(File tree unavailable)');
  }
  lines.push('');

  // Add key files content
  if (codebase.keyFiles.length > 0) {
    lines.push('### Key Files');
    lines.push('');

    for (const file of codebase.keyFiles.slice(0, 20)) {
      lines.push(`#### ${file.path}`);
      lines.push(`\`\`\`${file.language}`);
      // Truncate large files
      const maxContentLength = 5000;
      const content = file.content.length > maxContentLength
        ? file.content.slice(0, maxContentLength) + '\n\n... (truncated)'
        : file.content;
      lines.push(content);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Formats a file tree node into a string representation
 */
function formatFileTree(node: any, depth: number): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  if (typeof node !== 'object' || node === null) {
    return '';
  }

  for (const [name, child] of Object.entries(node)) {
    if (typeof child === 'object' && child !== null) {
      if ('children' in child && child.children) {
        // Directory
        lines.push(`${indent}📁 ${name}/`);
        lines.push(formatFileTree(child.children, depth + 1));
      } else if ('type' in child && child.type === 'file') {
        // File
        lines.push(`${indent}📄 ${name}`);
      } else {
        // Nested object (more directories)
        lines.push(`${indent}📁 ${name}/`);
        lines.push(formatFileTree(child, depth + 1));
      }
    }
  }

  return lines.join('\n');
}

/**
 * Builds section instructions with optional codebase context
 */
async function buildSectionInstructionsWithCodebase(
  ctx: any,
  projectId: string,
  baseInstructions: string,
  phaseId: string,
): Promise<string> {
  // Only include codebase for phases that benefit from it
  const codebaseRelevantPhases = ['specs', 'stories', 'artifacts'];
  if (!codebaseRelevantPhases.includes(phaseId)) {
    return baseInstructions;
  }

  const codebase = await fetchCodebaseForProject(ctx, projectId);
  if (!codebase) {
    return baseInstructions;
  }

  const codebaseContext = formatCodebaseContext(codebase);

  return `${baseInstructions}

---

${codebaseContext}`;
}
