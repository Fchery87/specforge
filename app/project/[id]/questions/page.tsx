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
import { Sparkles, Loader2 } from "lucide-react";
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="page-container py-20">
        <div className="text-center">
          <h1 className="text-xl font-bold">Project not found</h1>
        </div>
      </main>
    );
  }

  const skippedPhases = (project.skippedPhases ?? []) as readonly string[];
  const modeKey = (project.mode ?? "quick") as ProjectMode;
  const modeLabel = MODE_POLICIES[modeKey]?.label ?? "Lite";

  return (
    <main className="relative min-h-[calc(100vh-5rem)]">
      <div className="absolute inset-0 bg-grid-fade opacity-10 pointer-events-none" />

      {/* Back Navigation */}
      <div className="page-container py-6 relative z-10">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: project.title, href: `/project/${projectId}` },
            { label: "Questions" },
          ]}
        />
      </div>

      {/* Header */}
      <section className="page-container pb-8 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {modeLabel} Setup Round
          </span>
        </div>
        <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
          Project Questions
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Review and answer the core questions across all stages. AI suggestions are pre-filled below. When you are ready, click Generate everything to build your full specification bundle.
        </p>
      </section>

      {/* Combined Questions Form */}
      <section className="page-container pb-20 relative z-10">
        <CombinedQuestions
          projectId={projectId}
          phases={phases}
          skippedPhases={skippedPhases}
          isGenerating={isGenerating}
          onGenerateEverything={handleGenerateEverything}
          onRequestSuggestions={handleRequestSuggestions}
        />
      </section>
    </main>
  );
}
