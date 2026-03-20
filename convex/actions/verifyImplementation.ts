'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  resolveModelForCredentials,
  resolveCredentials,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { LlmModel } from '../../lib/llm/types';
import { createLlmClient } from '../../lib/llm/client-factory';
import { retryWithBackoff } from '../../lib/llm/retry';
import { rateLimiter } from '../rateLimiter';
import { logTelemetry } from '../../lib/llm/telemetry';
import {
  parseGitDiff,
  extractRelevantSpecs,
  buildVerificationPrompt,
  parseVerificationResponse,
  calculateScoreFromFindings,
  type Finding,
} from '../../lib/verification/spec-checker';

interface Artifact {
  _id: string;
  type: string;
  content: string;
}

interface VerifyResult {
  success: boolean;
  findings: Finding[];
  overallScore: number;
  status: 'pass' | 'fail' | 'warning';
  verificationId?: string;
}

export const verifyImplementation = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    gitDiff: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<VerifyResult> => {
    // Rate limit verification requests
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    await rateLimiter.limit(ctx, 'verifyImplementation', {
      key: identity.subject,
      throws: true,
    });

    // Verify project ownership and fetch artifacts in parallel
    const [project, allArtifacts] = await Promise.all([
      ctx.runQuery(
        internalApi.internal.getProjectInternal,
        { projectId: args.projectId },
      ),
      ctx.runQuery(
        api.artifacts.getAllProjectArtifacts,
        { projectId: args.projectId },
      ),
    ]);
    if (!project) throw new Error('Project not found');
    if (project.userId !== identity.subject) throw new Error('Forbidden');

    // Get relevant spec artifacts (constitution, specs, stories)
    const specArtifacts = (allArtifacts || [])
      .filter((a: Artifact) =>
        ['constitution', 'brief', 'prd', 'techSpec', 'userStories'].includes(a.type),
      )
      .map((a: Artifact) => ({ type: a.type, content: a.content }));

    if (specArtifacts.length === 0) {
      throw new Error(
        'No specification artifacts found. Generate specs before verifying implementation.',
      );
    }

    // Parse git diff
    const changedFiles = parseGitDiff(args.gitDiff);
    if (changedFiles.length === 0) {
      throw new Error('No file changes detected in git diff');
    }

    // Extract relevant spec content
    const specContent = extractRelevantSpecs(changedFiles, specArtifacts);

    // Resolve LLM credentials and model
    const userConfig = await ctx.runAction(
      internalApi.userConfigActions.getUserConfigInternal,
      {},
    );
    const systemCredentialsMap = await ctx.runAction(
      internalApi.internalActions.getAllDecryptedSystemCredentials,
      {},
    );
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal,
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);
    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {})),
      enabledModels,
    );

    if (!credentials) {
      throw new Error(
        'No LLM credentials configured. Please configure your API keys in Settings.',
      );
    }

    // Get model (prefer smaller/faster model for verification)
    const model: LlmModel = resolveModelForCredentials(credentials, enabledModelsFromDb || [], enabledModels);

    // Build verification prompt
    const prompt = buildVerificationPrompt({
      projectTitle: project.title,
      specContent,
      gitDiff: args.gitDiff,
      changedFiles,
    });

    // Create LLM client - takes credentials first
    const llmClient = createLlmClient(credentials);
    if (!llmClient) {
      throw new Error('Failed to initialize LLM client');
    }

    // Call LLM for verification
    const startedAt = Date.now();
    let verificationResult;

    try {
      const response = await retryWithBackoff(
        () =>
          llmClient.complete(prompt, {
            model: model.id,
            maxTokens: Math.min(4000, model.maxOutputTokens),
            temperature: 0.2, // Low temperature for consistent analysis
          }),
        { retries: 2, minDelayMs: 500, maxDelayMs: 3000 },
      );

      // Parse LLM response
      verificationResult = parseVerificationResponse(response.content);

      // Recalculate score based on findings for consistency
      const calculatedScore = calculateScoreFromFindings(verificationResult.findings);
      verificationResult.overallScore = Math.min(
        verificationResult.overallScore,
        calculatedScore,
      );

      const durationMs = Date.now() - startedAt;
      logTelemetry('info', {
        provider: model.provider,
        model: model.id,
        durationMs,
        success: true,
      });
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;
      logTelemetry('warn', {
        provider: model.provider,
        model: model.id,
        durationMs,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Store results in database
    const verificationId = await ctx.runMutation(
      internalApi.internal.createVerificationResult,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
        checkedAt: Date.now(),
        findings: verificationResult.findings,
        overallScore: verificationResult.overallScore,
        status: verificationResult.status,
      },
    );

    return {
      success: true,
      findings: verificationResult.findings,
      overallScore: verificationResult.overallScore,
      status: verificationResult.status,
      verificationId,
    };
  },
});
