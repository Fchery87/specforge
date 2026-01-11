"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Sparkles, ArrowRight, Clock, Zap, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  
  const projects = useQuery(
    api.projects.getProjects,
    isLoaded && isSignedIn ? {} : "skip"
  );

  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="page-container py-20">
        <div className="text-center">
          <p className="text-muted-foreground">You must be signed in to access the dashboard.</p>
          <Button asChild className="mt-4">
            <Link href={"/sign-in" as Route}>Sign In</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (projects === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  const sortedProjects = [...(projects || [])].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <main className="relative">
      {/* Hero Header with Grid Background */}
      <section className="page-header relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fade opacity-20" />
        <div className="page-container relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Command Center
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Your <span className="text-primary">Projects</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Create, manage, and forge your ideas into fully-specified, production-ready projects.
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* New Project Card - Primary CTA */}
          <Link href="/dashboard/new" className="md:col-span-2 lg:col-span-1 block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-primary bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-black group-hover:border-black transition-colors">
                  <Plus className="w-7 h-7 text-primary group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>New Project</CardTitle>
                <CardDescription>
                  Start from scratch with a fresh project brief
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary group-hover:text-black font-bold uppercase tracking-tight transition-colors">
                  Create Project <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Recent Activity Card */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Clock className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest project updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">No recent activity</p>
            </CardContent>
          </Card>

          {/* Quick Start Card */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Jump back into an existing project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">No projects yet</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Projects List Section */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            All Projects
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/new">
              <Plus className="w-4 h-4 mr-2" /> New
            </Link>
          </Button>
        </div>

        {sortedProjects.length === 0 ? (
          /* Empty State */
          <EmptyState
            variant="folder"
            title="No Projects Yet"
            description="Create your first project to start generating specs, stories, and artifacts with AI assistance."
          >
            <Link href="/dashboard/new">
              <Button className="mt-4">
                <Plus className="w-4 h-4 mr-2" /> Create First Project
              </Button>
            </Link>
          </EmptyState>
        ) : (
          /* Projects Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <Link key={project._id} href={`/project/${project._id}`} className="block">
                <Card variant="interactive" className="h-full group">
                  <CardHeader>
                    <CardTitle className="text-lg normal-case tracking-normal font-semibold group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{project.status}</span>
                      <span className="text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        FORGE
      </div>
    </main>
  );
}
