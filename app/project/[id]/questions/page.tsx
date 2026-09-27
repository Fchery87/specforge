"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Route } from "next";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateAllPhasesAction, generateAllQuestionAnswersAction } from "@/lib/convex-actions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CombinedQuestions, type CombinedAnswerItem } from "@/components/combined-questions";
import { GenerationReadinessBanner } from "@/components/generation-readiness-banner";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MODE_POLICIES, type ProjectMode } from "@/lib/workflow";

export default function CombinedQuestionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const projectId = params.id as Id<"projects">;
  const project = useQuery(
    api.projects.getProject,
    isLoaded && isSignedIn && projectId ? { projectId } : "skip"
  );
  const phases = useQuery(
    api.projects.getProjectPhases,
    isLoaded && isSignedIn && projectId ? { projectId } : "skip"
  );

  const readiness = useQuery(api.userConfigs.getGenerationReadiness);
  const saveAnswer = useMutation(api.projects.saveAnswer);
  const generateAllPhases = useAction(generateAllPhasesAction);
  const generateAllQuestionAnswers = useAction(generateAllQuestionAnswersAction);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleRequestSuggestions = useCallback(
    async (phaseId: string) => {
      try {
        await generateAllQuestionAnswers({ projectId, phaseId });
        toast.success("Suggestions updated");
      } catch (error) {
        toast.error("Failed to generate suggestions", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      }
    },
    [generateAllQuestionAnswers, projectId]
  );

  const handleGenerateEverything = useCallback(
    async (answers: CombinedAnswerItem[]) => {
      setIsGenerating(true);
      try {
        // Save all answers in parallel
        await Promise.all(
          answers.map((item) =>
            saveAnswer({
              projectId,
              phaseId: item.phaseId,
              questionId: item.questionId,
              answer: item.answer,
              aiGenerated: item.aiGenerated,
            })
          )
        );

        // Call generateAllPhases to kick off generation across stages
        const result = await generateAllPhases({ projectId });
        const count = result?.scheduled ?? 0;
        toast.success(`Scheduled ${count} phase${count === 1 ? "" : "s"} for generation`);

        // Navigate to project page where stage cards show live generation progress
        router.push(`/project/${projectId}` as Route);
      } catch (error) {
        console.error("Failed to generate everything:", error);
        toast.error("Generation failed", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
        setIsGenerating(false);
      }
    },
    [generateAllPhases, projectId, router, saveAnswer]
  );

  if (!isLoaded || project === undefined || phases === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="page-container py-20">
        <div className="text-center">
          <h1 className="text-title font-bold">Project not found</h1>
        </div>
      </main>
    );
  }

  const skippedPhases = (project.skippedPhases ?? []) as readonly string[];
  const modeKey = (project.mode ?? "quick") as ProjectMode;
  const modeLabel = MODE_POLICIES[modeKey]?.label ?? "Lite";

  return (
    <main className="min-h-[calc(100vh-var(--header-height))]">

      {/* Back Navigation */}
      <div className="page-container py-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: project.title, href: `/project/${projectId}` },
            { label: "Generate all phases" },
          ]}
        />
      </div>

      <section className="page-container pb-8">
        <p className="text-label text-dim">{modeLabel} mode</p>
        <h1 className="mt-2 font-display text-heading font-semibold text-ink">Generate all phases</h1>
        <p className="mt-3 max-w-xl text-body text-muted-foreground">
          Check the answers for every phase in one place. Suggested answers are filled in for you. When
          they read right, generate all phases and follow the progress on the project page.
        </p>
      </section>

      {/* Combined Questions Form */}
      <section className="page-container pb-20">
        <GenerationReadinessBanner ready={readiness?.ready ?? true} className="mb-6" />
        <CombinedQuestions
          projectId={projectId}
          phases={phases}
          skippedPhases={skippedPhases}
          isGenerating={isGenerating}
          onGenerateEverything={handleGenerateEverything}
          onRequestSuggestions={handleRequestSuggestions}
          modelReady={readiness?.ready ?? true}
        />
      </section>
    </main>
  );
}
