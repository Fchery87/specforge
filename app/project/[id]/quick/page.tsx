"use client";

import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ArtifactPreview } from '@/components/artifact-preview';
import { EvidenceReviewPanel } from '@/components/evidence-review-panel';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function ProjectQuickSpecPage() {
  const params = useParams<{ id: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const projectId = params.id as Id<'projects'>;
  const project = useQuery(api.projects.getProject, isLoaded && isSignedIn ? { projectId } : 'skip');
  const artifact = useQuery(api.artifacts.getArtifactByPhase, isLoaded && isSignedIn ? { projectId, phaseId: 'quick' } : 'skip');

  if (!isLoaded || project === undefined || artifact === undefined) {
    return <main className="page-container py-20 text-center"><Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" /></main>;
  }
  if (!project) return <main className="page-container py-20">Project not found.</main>;

  return (
    <main className="page-container py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={`/project/${projectId}` as Route}
            className="rounded-sm text-label text-dim hover:text-ink focus-ring"
          >
            {project.title}
          </Link>
          <h1 className="mt-2 font-display text-heading font-semibold text-ink">Saved quick specs</h1>
          <p className="mt-3 max-w-xl text-body text-muted-foreground">
            The quick spec saved to this project, with its claims and the evidence behind them.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/quick">New quick spec</Link>
        </Button>
      </div>
      <div className="mt-10 flex flex-col gap-8">
        {artifact ? (
          <>
            <ArtifactPreview artifact={artifact} projectId={String(projectId)} />
            <EvidenceReviewPanel projectId={projectId} artifactId={artifact._id} />
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-ui text-dim">
            No quick spec is saved to this project yet. Generate one from Quick spec and save it here.
          </p>
        )}
      </div>
    </main>
  );
}
