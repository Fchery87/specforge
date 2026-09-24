"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateQuickSpecAction } from "@/lib/convex-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Zap } from "lucide-react";
import { MermaidAwareContent } from "@/components/ui/mermaid-aware-content";
import { toast } from "sonner";

export default function QuickSpecPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [savedArtifactId, setSavedArtifactId] = useState<Id<"artifacts"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const generateQuickSpec = useAction(generateQuickSpecAction);
  const projects = useQuery(api.projects.getProjects);
  const saveQuickSpec = useMutation(api.artifacts.saveQuickSpec);

  async function handleGenerate() {
    if (!title.trim() || !description.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateQuickSpec({
        title: title.trim(),
        description: description.trim(),
      });
      setResult(res.content);
      setSavedArtifactId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!result || !projectId) return;
    setIsSaving(true);
    try {
      const artifactId = await saveQuickSpec({
        projectId: projectId as Id<"projects">,
        title: title.trim(),
        content: result,
      });
      setSavedArtifactId(artifactId);
      toast.success("Quick Spec saved to project history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save Quick Spec");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-5rem)]">
      <div className="absolute inset-0 bg-grid-fade opacity-10" />

      <div className="page-container py-6 relative z-10">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Quick Spec" },
          ]}
        />
      </div>

      <section className="page-container pb-8 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-black" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Quick Spec
          </span>
        </div>
        <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
          Generate a Quick Spec
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Describe a feature, task, or refactor to generate a fast one-page specification with architectural decisions, sequence diagrams, and direct project saving.
        </p>
      </section>

      <section className="page-container page-section border-t-2 border-border relative z-10">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Form */}
          <div className="space-y-4">
            <div>
              <label htmlFor="quick-spec-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
                Task Title
              </label>
              <input
                id="quick-spec-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Add OAuth2 authentication with Google and GitHub"
                className="w-full bg-secondary/30 border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="quick-spec-description" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
                Description
              </label>
              <textarea
                id="quick-spec-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specify the desired behavior, affected components, state changes, error handling, and test criteria..."
                rows={6}
                className="w-full bg-secondary/30 border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !title.trim() || !description.trim()}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {isGenerating ? "Forging Spec…" : "Generate Spec"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Result */}
          <div>
            {result ? (
              <Card variant="static" className="border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base normal-case tracking-normal font-semibold">
                    {title}
                  </CardTitle>
                  <CardDescription>Architectural Blueprint & Diagram</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label htmlFor="quick-spec-project" className="sr-only">Save to project</label>
                    <div className="min-w-[200px] flex-1">
                      <Select
                        value={projectId}
                        onValueChange={(value) => {
                          setProjectId(value);
                          setSavedArtifactId(null);
                        }}
                      >
                        <SelectTrigger id="quick-spec-project" className="w-full">
                          <SelectValue placeholder="Save to project…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(projects ?? []).map((project) => (
                            <SelectItem key={project._id} value={project._id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleSave} disabled={!projectId || isSaving} variant="outline" className="gap-2 shrink-0">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isSaving ? "Saving…" : savedArtifactId ? "Save new version" : "Save Quick Spec"}
                    </Button>
                  </div>
                  {savedArtifactId && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      Saved. <Link className="underline" href={`/project/${projectId}/quick` as Route}>Open project history</Link>
                    </p>
                  )}
                  <div className="bg-secondary/30 border-t border-border p-4 max-h-[600px] overflow-y-auto">
                    <MermaidAwareContent markdown={result} />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card
                variant="static"
                className="border h-full flex items-center justify-center min-h-[300px]"
              >
                <CardContent className="text-center text-muted-foreground">
                  <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Your generated specification and architecture diagram will render here. You can then save it directly to project history.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
