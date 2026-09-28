"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectNav } from "@/components/project-nav";
import { CheckReport } from "@/components/checks/check-report";
import { MODE_POLICIES, phaseLabel, type ProjectMode } from "@/lib/workflow";
import { sourceLabel } from "@/lib/verification/words";

export default function CheckPage() {
  const params = useParams<{ id: string; checkId: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const projectId = params.id as Id<"projects">;
  const checkId = params.checkId as Id<"verificationResults">;
  const ready = isLoaded && isSignedIn;

  const project = useQuery(api.projects.getProject, ready ? { projectId } : "skip");
  const phases = useQuery(api.projects.getProjectPhases, ready ? { projectId } : "skip");
  const data = useQuery(api.verification.getCheck, ready ? { checkId } : "skip");

  if (project === null || (data && data.check.projectId !== projectId)) {
    return (
      <main className="page-container py-20">
        <h1 className="font-display text-heading font-semibold text-ink">
          {project === null ? "Project not found" : "This check belongs to another project"}
        </h1>
        <p className="mt-3 max-w-md text-body text-muted-foreground">Open it from the project it was run in.</p>
      </main>
    );
  }

  if (project === undefined || !data || phases === undefined) {
    return (
      <main className="page-container py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-var(--header-height))]">
      <div className="page-container py-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-12">
        <ProjectNav
          projectId={projectId}
          title={project.title}
          modeLabel={MODE_POLICIES[(project.mode ?? "full") as ProjectMode]?.label ?? "Full"}
          phases={phases}
          skippedPhases={project.skippedPhases ?? []}
          currentLabel="Pull-request check"
        />
        <div className="min-w-0 pt-6 lg:pt-0">
          <p className="text-label text-dim">Pull-request check</p>
          <h1 className="mt-2 font-display text-heading font-semibold text-ink">
            {sourceLabel(data.check.source, data.check.phaseId ? phaseLabel(data.check.phaseId) : undefined)}
          </h1>
          <div className="mt-6">
            <CheckReport
              projectId={projectId}
              check={data.check}
              requirements={data.requirements}
              repositoryUrl={data.repositoryUrl}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
