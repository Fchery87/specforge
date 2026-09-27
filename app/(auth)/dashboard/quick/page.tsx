"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateQuickSpecAction } from "@/lib/convex-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConnectModelNote,
  GenerationReadinessBanner,
} from "@/components/generation-readiness-banner";
import { Loader2 } from "lucide-react";
import { MermaidAwareContent } from "@/components/ui/mermaid-aware-content";
import { toast } from "sonner";

export default function QuickSpecPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [savedArtifactId, setSavedArtifactId] = useState<Id<"artifacts"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const generateQuickSpec = useAction(generateQuickSpecAction);
  const projects = useQuery(api.projects.getProjects);
  const readiness = useQuery(api.userConfigs.getGenerationReadiness);
  const saveQuickSpec = useMutation(api.artifacts.saveQuickSpec);
  const createProjectFromQuickSpec = useMutation(api.projects.createProjectFromQuickSpec);

  const modelReady = readiness?.ready ?? true;

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

  async function handleStartProject() {
    if (!result) return;
    setIsStarting(true);
    try {
      const newProjectId = await createProjectFromQuickSpec({
        title: title.trim(),
        description: description.trim(),
        content: result,
      });
      router.push(`/project/${newProjectId}` as Route);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to start a project");
      setIsStarting(false);
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
      toast.success("Quick spec saved to the project");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save the quick spec");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page-container py-10 md:py-14">
      <h1 className="font-display text-heading font-semibold text-ink">Quick spec</h1>
      <p className="mt-3 max-w-xl text-body text-muted-foreground">
        Describe one feature, fix or refactor and get a one-page spec. Keep it, or start a project from
        it when it needs the full workflow.
      </p>

      <GenerationReadinessBanner ready={modelReady} className="mt-8" />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="quick-spec-title" className="mb-2 block text-label text-muted-foreground">
              Title
            </label>
            <Input
              id="quick-spec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add sign-in with Google and GitHub"
            />
          </div>
          <div>
            <label htmlFor="quick-spec-description" className="mb-2 block text-label text-muted-foreground">
              Description
            </label>
            <Textarea
              id="quick-spec-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The behaviour you want, the parts it touches, how errors are handled and how you will test it."
              rows={7}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!modelReady || isGenerating || !title.trim() || !description.trim()}
            className="w-full"
          >
            {isGenerating ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {isGenerating ? "Generating…" : "Generate spec"}
          </Button>
          {!modelReady ? <ConnectModelNote className="text-ui text-muted-foreground" /> : null}
          {error ? <p className="text-ui text-destructive">{error}</p> : null}
        </div>

        <section
          aria-label="Generated spec"
          className="min-h-[18rem] rounded-lg border border-line bg-surface"
        >
          {result ? (
            <>
              <div className="flex flex-col gap-4 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
                <h2 className="font-display text-title font-semibold text-ink">{title}</h2>
                <Button onClick={handleStartProject} disabled={isStarting} className="shrink-0">
                  {isStarting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  Start a project from this
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                <label htmlFor="quick-spec-project" className="text-ui text-muted-foreground">
                  Or save it to
                </label>
                <div className="min-w-[12rem] flex-1">
                  <Select
                    value={projectId}
                    onValueChange={(value) => {
                      setProjectId(value);
                      setSavedArtifactId(null);
                    }}
                  >
                    <SelectTrigger id="quick-spec-project" className="w-full">
                      <SelectValue placeholder="An existing project" />
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
                <Button onClick={handleSave} disabled={!projectId || isSaving} variant="outline" className="shrink-0">
                  {isSaving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  {savedArtifactId ? "Save new version" : "Save"}
                </Button>
                {savedArtifactId ? (
                  <p className="basis-full text-ui text-muted-foreground">
                    Saved.{" "}
                    <Link className="text-ink underline underline-offset-4" href={`/project/${projectId}/quick` as Route}>
                      Open the project&apos;s quick specs
                    </Link>
                  </p>
                ) : null}
              </div>

              <div className="max-h-[40rem] overflow-y-auto px-5 py-5">
                <MermaidAwareContent markdown={result} />
              </div>
            </>
          ) : (
            <p className="flex h-full min-h-[18rem] items-center justify-center px-6 text-center text-ui text-dim">
              The spec appears here once it is generated.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
