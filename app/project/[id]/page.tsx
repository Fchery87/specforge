"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PhaseStepper } from "@/components/phase-stepper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, Sparkles, Layers, FileText, Code, Package, Target, ClipboardList } from "lucide-react";

const PHASES = [
  { id: "brief", label: "Brief", icon: FileText, description: "Define your project scope and requirements" },
  { id: "prd", label: "PRD", icon: Target, description: "Formal product requirements and goals" },
  { id: "specs", label: "Spec & Architecture", icon: Layers, description: "Technical specifications and design" },
  { id: "stories", label: "Tasks/Stories", icon: ClipboardList, description: "User stories and task breakdown" },
  { id: "artifacts", label: "Artifacts", icon: Sparkles, description: "Generated assets and codebase models" },
  { id: "handoff", label: "Handoff + ZIP", icon: Package, description: "Final deliverables and documentation" },
];

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const project = useQuery(api.projects.getProject, { projectId: params.id as any });

  if (!project) {
    return (
      <main className="relative min-h-[calc(100vh-5rem)]">
        <div className="absolute inset-0 bg-grid-fade opacity-10" />
        <div className="page-container py-6">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="page-container">
          <div className="mb-12">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-16 w-2/3 mb-4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100vh-5rem)]">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-fade opacity-10" />

      {/* Back Navigation */}
      <div className="page-container py-6 relative z-10">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Project Header */}
      <section className="page-container pb-12 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Project
          </span>
        </div>
        <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
          {project.title}
        </h1>
        {project.description && (
          <p className="text-xl text-muted-foreground max-w-3xl line-clamp-2">
            {project.description}
          </p>
        )}
      </section>

      {/* Phase Stepper */}
      <section className="page-container pb-8 relative z-10">
        <PhaseStepper projectId={params.id} currentPhase="brief" />
      </section>

      {/* Phase Cards */}
      <section className="page-container page-section border-t-2 border-border relative z-10">
        <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-8">
          Workflow Phases
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((phase, idx) => (
            <Link key={phase.id} href={`/project/${params.id}/phase/${phase.id}`} className="block">
              <Card 
                variant="interactive"
                className="relative h-full group"
              >
                <CardHeader>
                  <div className="text-6xl font-bold text-muted/20 absolute top-4 right-4 group-hover:text-black/10 transition-colors">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="w-12 h-12 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:border-black group-hover:bg-black/10 transition-colors">
                    <phase.icon className="w-6 h-6 text-muted-foreground group-hover:text-black transition-colors" />
                  </div>
                  <CardTitle>{phase.label}</CardTitle>
                  <CardDescription>{phase.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-primary group-hover:text-black font-bold uppercase tracking-tight text-sm transition-colors">
                    Enter Phase <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Decorative Element */}
      <div className="text-[12vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden mt-12">
        {project.title?.split(' ')[0]?.toUpperCase() || 'PROJECT'}
      </div>
    </main>
  );
}
