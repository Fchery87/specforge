"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookTemplate, ChevronDown, ChevronUp, Loader2, Zap, Compass, Server } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { PromptEnhanceButton } from "@/components/prompt-enhance-button";
import { GenerationReadinessBanner } from "@/components/generation-readiness-banner";
import { toast } from "sonner";

import { TITLE_MAX, DESCRIPTION_MAX } from "@/lib/project-input";
import { MODE_POLICIES, type ProjectMode } from "@/lib/workflow";

const MODE_ICON: Record<ProjectMode, React.ReactNode> = {
  quick: <Zap className="size-4 text-warning" />,
  full: <Compass className="size-4 text-primary" />,
  backend: <Server className="size-4 text-info" />,
};

const MODE_ORDER: readonly ProjectMode[] = ['quick', 'full', 'backend'] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.createProject);
  const templates = useQuery(api.constitutionTemplates.listTemplates);
  const readiness = useQuery(api.userConfigs.getGenerationReadiness);


  const [selectedMode, setSelectedMode] = useState<ProjectMode>('quick');
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<Id<"constitutionTemplates"> | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const titleLeft = TITLE_MAX - title.length;
  const descLeft = DESCRIPTION_MAX - description.length;
  const isValid = title.trim().length > 0 && description.trim().length > 0;

  async function onSubmit() {
    if (!isValid || isCreating) return;
    setIsCreating(true);
    try {
      const id = await createProject({
        title: title.slice(0, TITLE_MAX),
        description: description.slice(0, DESCRIPTION_MAX),
        constitutionTemplateId: selectedTemplateId ?? undefined,
        mode: selectedMode,
      });
      router.push(`/project/${id}` as Route);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project", {
        description: error instanceof Error ? error.message : "Please try again or check your connection.",
        duration: 5000,
      });
      setIsCreating(false);
    }
  }

  const selectedTemplate = templates?.find((t) => t._id === selectedTemplateId) ?? null;

  return (
    <main className="min-h-[calc(100vh-var(--header-height))]">

      {/* Back Navigation */}
      <div className="page-container py-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-ink transition-colors font-medium"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Main Content */}
      <div className="page-container pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="mb-4 font-display text-heading font-semibold text-ink">New project</h1>
            <p className="max-w-xl text-body text-muted-foreground">
              Name the project and describe its scope. The more you say about users, workflows and limits,
              the fewer questions SpecForge asks later. You can connect a GitHub repository from the project page.
            </p>
          </div>

          {/* Generation Readiness Banner */}
          <GenerationReadinessBanner ready={readiness?.ready ?? true} className="mb-6" />

          {/* Form Card */}
          <Card variant="static" className="border">
            <CardContent className="space-y-8 pt-6">
              {/* Specification Mode Selector */}
              <div className="space-y-3">
                <label className="text-ui font-semibold text-muted-foreground">
                  Specification Mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {MODE_ORDER.map((modeId) => {
                    const isSelected = selectedMode === modeId;
                    const mode = MODE_POLICIES[modeId];
                    return (
                      <button
                        key={modeId}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedMode(modeId)}
                        disabled={isCreating}
                        className={`text-left p-4 border transition-colors cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-line hover:border-muted-foreground/50 bg-raised/10"
                        }`}
                      >
                        <div>
                          <span className="mb-2 flex items-center gap-1.5 text-ui font-semibold">
                            {MODE_ICON[modeId]}
                            {mode.label}
                          </span>
                          <p className="text-caption text-muted-foreground mb-3 leading-relaxed">
                            {mode.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input - Hero Style */}
              <div className="space-y-3">
                <label className="text-ui font-semibold text-muted-foreground">
                  Project Title
                </label>
                <Input
                  inputSize="hero"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="e.g., Real-time Collaborative Canvas"
                  disabled={isCreating}
                />
                <div className="flex justify-between text-ui">
                  <span className="text-muted-foreground">Use a clear, descriptive name</span>
                  <span className={titleLeft < 20 ? "text-warning" : "text-muted-foreground"}>
                    {titleLeft} characters left
                  </span>
                </div>
              </div>

              {/* Description Textarea */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-ui font-semibold text-muted-foreground">
                    Project Description
                  </label>
                  <PromptEnhanceButton
                    prompt={description}
                    onEnhance={setDescription}
                    disabled={isCreating}
                    minLength={10}
                    maxLength={4000}
                  />
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
                  placeholder={
                    selectedMode === "quick"
                      ? "Describe the feature or problem statement. Specify key user actions, acceptance criteria, constraints, and integration boundaries..."
                      : selectedMode === "backend"
                      ? "Describe the service, API endpoints, core data models, throughput requirements, and database/storage preferences..."
                      : "Describe the system in detail. Specify user personas, critical workflows, integrations, data structures, and architectural non-goals..."
                  }
                  className="min-h-[200px] text-body"
                  disabled={isCreating}
                />
                <div className="flex justify-between text-ui">
                  <span className="text-muted-foreground">Be as detailed as possible</span>
                  <span className={descLeft < 1000 ? "text-warning" : "text-muted-foreground"}>
                    {descLeft.toLocaleString()} characters left
                  </span>
                </div>
              </div>

              {/* Constitution Templates */}
              <div className="border border-line">
                <button
                  type="button"
                  onClick={() => setTemplatesOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-raised/50 transition-colors"
                  disabled={isCreating}
                >
                  <div className="flex items-center gap-2">
                    <BookTemplate className="size-4 text-muted-foreground" />
                    <span className="text-ui font-semibold text-muted-foreground">
                      Constitution Templates
                    </span>
                    {templates !== undefined && (
                      <span className="text-caption font-semibold bg-raised px-2 py-0.5 text-muted-foreground">
                        {templates.length === 0 ? "No templates" : `${templates.length} template${templates.length === 1 ? "" : "s"}`}
                      </span>
                    )}
                    {selectedTemplate && (
                      <span className="text-caption font-semibold bg-primary text-primary-foreground px-2 py-0.5">
                        {selectedTemplate.name}
                      </span>
                    )}
                  </div>
                  {templatesOpen ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>

                {templatesOpen && (
                  <div className="border-t border-line p-4">
                    {templates === undefined && (
                      <div className="flex items-center gap-2 text-muted-foreground text-ui py-4 justify-center">
                        <Loader2 className="size-4 animate-spin" />
                        Loading templates…
                      </div>
                    )}

                    {templates !== undefined && templates.length === 0 && (
                      <div className="text-center py-6 space-y-2">
                        <BookTemplate className="size-8 text-muted-foreground mx-auto" />
                        <p className="text-ui text-muted-foreground">No templates saved yet.</p>
                        <p className="text-caption text-muted-foreground">
                          Save a project&apos;s constitution as a template to reuse it here.
                        </p>
                      </div>
                    )}

                    {templates !== undefined && templates.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-caption text-muted-foreground mb-3">
                          Select a template to pre-apply its constitution constraints to this project.
                        </p>
                        {/* None option */}
                        <label
                          className={`flex items-start gap-3 p-3 cursor-pointer border transition-colors ${
                            selectedTemplateId === null
                              ? "border-primary bg-primary/5"
                              : "border-line hover:border-muted-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            name="constitutionTemplate"
                            className="mt-0.5 accent-primary"
                            checked={selectedTemplateId === null}
                            onChange={() => setSelectedTemplateId(null)}
                            disabled={isCreating}
                          />
                          <span className="flex flex-col">
                            <span className="text-ui font-semibold">No template</span>
                            <span className="text-caption text-muted-foreground">Start with a blank constitution</span>
                          </span>
                        </label>

                        {templates.map((template) => (
                          <label
                            key={template._id}
                            className={`flex items-start gap-3 p-3 cursor-pointer border transition-colors ${
                              selectedTemplateId === template._id
                                ? "border-primary bg-primary/5"
                                : "border-line hover:border-muted-foreground"
                            }`}
                          >
                            <input
                              type="radio"
                              name="constitutionTemplate"
                              className="mt-0.5 accent-primary"
                              checked={selectedTemplateId === template._id}
                              onChange={() => setSelectedTemplateId(template._id)}
                              disabled={isCreating}
                            />
                            <span className="flex flex-col min-w-0 flex-1">
                              <span className="flex items-center gap-2 flex-wrap">
                                <span className="text-ui font-semibold">{template.name}</span>
                                {template.usageCount > 0 && (
                                  <span className="text-caption text-muted-foreground">
                                    Used {template.usageCount}×
                                  </span>
                                )}
                              </span>
                              <span className="text-caption text-muted-foreground mt-0.5">{template.description}</span>
                              {template.lockedConstraints?.architecture && (
                                <span className="text-caption text-muted-foreground mt-1">
                                  Architecture: {template.lockedConstraints.architecture}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-6 border-t border-line">
                <p className="text-ui text-muted-foreground">
                  {isValid ? "Ready to create your project" : "Fill in both fields to continue"}
                </p>
                <Button
                  onClick={onSubmit}
                  disabled={!isValid || isCreating}
                  className="min-w-[200px]"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </main>
  );
}
