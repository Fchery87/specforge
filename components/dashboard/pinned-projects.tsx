'use client';

import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, ArrowRight, Plus } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface PinnedProject {
  _id: string;
  title: string;
  status: 'draft' | 'active' | 'complete';
  updatedAt: number;
}

function PinnedProjectCard({ project, index }: { project: PinnedProject; index: number }) {
  return (
    <Link href={`/project/${project._id}`} className="block group">
      <Card
        className={cn(
          'h-full transition-colors duration-(--duration-standard) hover:border-primary/50',
          'border-l',
          project.status === 'complete' && 'border-l-success',
          project.status === 'active' && 'border-l-primary',
          project.status === 'draft' && 'border-l-line-strong'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-title font-semibold text-muted/20">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Pin className="size-4 text-primary fill-primary" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="font-bold text-ui truncate group-hover:text-primary transition-colors">
            {project.title}
          </h3>
          <div className="flex items-center justify-between mt-2">
            <span className="text-caption text-muted-foreground capitalize">{project.status}</span>
            <span className="text-caption text-muted-foreground">{formatRelativeTime(project.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PinnedProjectsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="h-[120px]">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-8" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PinnedProjects() {
  const pinnedProjects = useQuery(api.userPreferences.getPinnedProjects);

  if (pinnedProjects === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Pin className="size-5 text-primary" />
          <h2 className="text-ui font-bold text-muted-foreground">
            Pinned Projects
          </h2>
        </div>
        <PinnedProjectsSkeleton />
      </div>
    );
  }

  if (pinnedProjects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Pin className="size-5 text-primary" />
          <h2 className="text-ui font-bold text-muted-foreground">
            Pinned Projects
          </h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <div className="size-12 mx-auto mb-3 rounded-sm bg-raised/50 flex items-center justify-center">
              <Pin className="size-6 text-muted-foreground" />
            </div>
            <p className="text-ui text-muted-foreground">No pinned projects</p>
            <p className="text-caption text-muted-foreground mt-1">
              Pin your most important projects for quick access
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Pin className="size-5 text-primary" />
          <div className="absolute -top-1 -right-1 size-2 bg-primary rounded-full" />
        </div>
        <h2 className="text-ui font-bold text-muted-foreground">
          Pinned Projects
        </h2>
        <span className="text-caption px-2 py-0.5 bg-raised/50 text-muted-foreground">
          {pinnedProjects.length}/5
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {pinnedProjects.map((project, index) => (
          <PinnedProjectCard key={project._id} project={project as PinnedProject} index={index} />
        ))}
      </div>
    </div>
  );
}
