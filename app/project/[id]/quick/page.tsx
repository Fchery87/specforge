"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ArtifactPreview } from '@/components/artifact-preview';
import { EvidenceReviewPanel } from '@/components/evidence-review-panel';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function ProjectQuickSpecPage() {
  const params = useParams<{ id: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const projectId = params.id as Id<'projects'>;
  const project = useQuery(api.projects.getProject, isLoaded && isSignedIn ? { projectId } : 'skip');
  const artifact = useQuery(api.artifacts.getArtifactByPhase, isLoaded && isSignedIn ? { projectId, phaseId: 'quick' } : 'skip');

  if (!isLoaded || project === undefined || artifact === undefined) {
    return <main className="page-container py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></main>;
  }
  if (!project) return <main className="page-container py-20">Project not found.</main>;

  return (
    <main className="page-container py-8">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: project.title, href: `/project/${projectId}` }, { label: 'Quick Spec history' }]} />
      <div className="my-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-v-h2 font-bold uppercase tracking-tighter">Quick Spec History</h1>
          <p className="mt-2 text-muted-foreground">Saved architectural blueprints and diagrams for {project.title}. Inspect versioned claims and review attached evidence.</p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/quick">Generate Quick Spec</Link></Button>
      </div>
      {artifact ? (
        <>
          <ArtifactPreview artifact={artifact} projectId={String(projectId)} />
          <EvidenceReviewPanel projectId={projectId} artifactId={artifact._id} />
        </>
      ) : <p className="border border-dashed border-border p-8 text-muted-foreground">No Quick Spec has been saved to this project yet. Generate a one-page specification from the dashboard and save it here.</p>}
    </main>
  );
}
