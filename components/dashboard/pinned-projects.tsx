'use client';

import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, ArrowRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinnedProject {
  _id: string;
  title: string;
  status: 'draft' | 'active' | 'complete';
  updatedAt: number;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function PinnedProjectCard({ project, index }: { project: PinnedProject; index: number }) {
  return (
    <Link href={`/project/${project._id}`} className="block group">
      <Card
        className={cn(
          'h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-primary/50',
          'border-l-4',
          project.status === 'complete' && 'border-l-emerald-500',
          project.status === 'active' && 'border-l-primary',
          project.status === 'draft' && 'border-l-muted'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-muted/20">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Pin className="w-4 h-4 text-primary fill-primary" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
            {project.title}
          </h3>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground capitalize">{project.status}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(project.updatedAt)}</span>
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
          <Pin className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
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
          <Pin className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Pinned Projects
          </h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-none bg-muted/50 flex items-center justify-center">
              <Pin className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No pinned projects</p>
            <p className="text-xs text-muted-foreground mt-1">
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
          <Pin className="w-5 h-5 text-primary" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Pinned Projects
        </h2>
        <span className="text-[10px] px-2 py-0.5 bg-secondary/50 text-muted-foreground">
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
