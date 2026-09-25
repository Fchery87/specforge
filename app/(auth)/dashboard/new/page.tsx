"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookTemplate, ChevronDown, ChevronUp, Loader2, Sparkles, GitBranch, Zap, Compass, Server } from "lucide-react";
import Link from "next/link";
import { PromptEnhanceButton } from "@/components/prompt-enhance-button";
import { CodebaseConnector } from "@/components/codebase-connector";
import { toast } from "sonner";
import { TITLE_MAX, DESCRIPTION_MAX } from "@/lib/project-input";

type ProjectMode = 'full' | 'quick' | 'backend';

interface ProjectModeOption {
  id: ProjectMode;
  name: string;
  badge: string;
  description: string;
  phasesSummary: string;
  icon: React.ReactNode;
}

const PROJECT_MODES: ProjectModeOption[] = [
  {
    id: 'quick',
    name: 'Quick Feature Spec',
    badge: 'Fast-Track',
    description: 'Brisk specification for a targeted feature or bug fix. Focuses on requirements, technical architecture, and stories.',
    phasesSummary: 'Brief → PRD → Specs → Stories → Handoff',
    icon: <Zap className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'full',
    name: 'Full System Blueprint',
    badge: 'Enterprise',
    description: 'Comprehensive 8-phase architecture specification for greenfield systems and major platform initiatives.',
    phasesSummary: 'All 8 phases: Constitution through Handoff',
    icon: <Compass className="w-4 h-4 text-primary" />,
  },
  {
    id: 'backend',
    name: 'API & Backend Service',
    badge: 'Architecture',
    description: 'Service contracts, domain models, schemas, and API specifications for microservices and backend platforms.',
    phasesSummary: 'Constitution → Domain → Specs → Artifacts → Handoff',
    icon: <Server className="w-4 h-4 text-blue-500" />,
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.createProject);
  const templates = useQuery(api.constitutionTemplates.listTemplates);

  const [selectedMode, setSelectedMode] = useState<ProjectMode>('quick');
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<Id<"constitutionTemplates"> | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [showRepoConnector, setShowRepoConnector] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<Id<"projects"> | null>(null);

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
      // Show repo connector step instead of immediately redirecting
      setCreatedProjectId(id);
      setShowRepoConnector(true);
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project", {
        description: error instanceof Error ? error.message : "Please try again or check your connection.",
        duration: 5000,
      });
      setIsCreating(false);
    }
  }

  function handleSkipRepo() {
    if (createdProjectId) {
      if (selectedMode === 'quick') {
        router.push(`/project/${createdProjectId}/phase/brief`);
      } else {
        router.push(`/project/${createdProjectId}`);
      }
    }
  }

  const selectedTemplate = templates?.find((t) => t._id === selectedTemplateId) ?? null;

  return (
    <main className="relative min-h-[calc(100vh-5rem)]">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-fade opacity-10 pointer-events-none" />

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

      {/* Main Content */}
      <div className="page-container pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                New Project
              </span>
            </div>
            <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
              Start <span className="text-primary">Building</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Provide a project title and initial scope. Detailed requirements, user personas, and system boundaries yield sharper specifications.
            </p>
          </div>

          {/* Form Card */}
          <Card variant="static" className="border-2">
            {showRepoConnector && createdProjectId ? (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary flex items-center justify-center">
                      <GitBranch className="w-5 h-5 text-black" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Step 2 of 2
                    </span>
                  </div>
                  <CardTitle className="text-xl normal-case tracking-normal font-semibold">
                    Connect Your Repository (Optional)
                  </CardTitle>
                  <CardDescription>
                    Link a GitHub repository to pin file citations to specific commits. SpecForge references your file paths and architectural patterns during generation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <CodebaseConnector 
                    projectId={createdProjectId} 
                    onComplete={handleSkipRepo}
                  />
                  <div className="flex items-center justify-center">
                    <Button 
                      variant="ghost" 
                      onClick={handleSkipRepo}
                      className="text-muted-foreground"
                    >
                      Skip and view project →
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-xl normal-case tracking-normal font-semibold">Project Details</CardTitle>
                  <CardDescription>
                    Define your project title and core requirements. The initial brief establishes your evidence baseline.
                  </CardDescription>
                </CardHeader>
            <CardContent className="space-y-8">
              {/* Specification Mode Selector */}
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Specification Mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PROJECT_MODES.map((mode) => {
                    const isSelected = selectedMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSelectedMode(mode.id)}
                        disabled={isCreating}
                        className={`text-left p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm"
                            : "border-border hover:border-muted-foreground/50 bg-secondary/10"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-semibold text-sm flex items-center gap-1.5">
                              {mode.icon}
                              {mode.name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-muted text-muted-foreground">
                              {mode.badge}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                            {mode.description}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
                          {mode.phasesSummary}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input - Hero Style */}
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Project Title
                </label>
                <Input
                  inputSize="hero"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="e.g., Real-time Collaborative Canvas"
                  disabled={isCreating}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Use a clear, descriptive name</span>
                  <span className={titleLeft < 20 ? "text-warning" : "text-muted-foreground"}>
                    {titleLeft} characters left
                  </span>
                </div>
              </div>

              {/* Description Textarea */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
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
                  className="min-h-[200px] text-base"
                  disabled={isCreating}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Be as detailed as possible</span>
                  <span className={descLeft < 1000 ? "text-warning" : "text-muted-foreground"}>
                    {descLeft.toLocaleString()} characters left
                  </span>
                </div>
              </div>

              {/* Constitution Templates */}
              <div className="border border-border">
                <button
                  type="button"
                  onClick={() => setTemplatesOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  disabled={isCreating}
                >
                  <div className="flex items-center gap-2">
                    <BookTemplate className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Constitution Templates
                    </span>
                    {templates !== undefined && (
                      <span className="text-xs font-semibold bg-muted px-2 py-0.5 text-muted-foreground">
                        {templates.length === 0 ? "No templates" : `${templates.length} template${templates.length === 1 ? "" : "s"}`}
                      </span>
                    )}
                    {selectedTemplate && (
                      <span className="text-xs font-semibold bg-primary text-black px-2 py-0.5">
                        {selectedTemplate.name}
                      </span>
                    )}
                  </div>
                  {templatesOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {templatesOpen && (
                  <div className="border-t border-border p-4">
                    {templates === undefined && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading templates…
                      </div>
                    )}

                    {templates !== undefined && templates.length === 0 && (
                      <div className="text-center py-6 space-y-2">
                        <BookTemplate className="w-8 h-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">No templates saved yet.</p>
                        <p className="text-xs text-muted-foreground">
                          Save a project&apos;s constitution as a template to reuse it here.
                        </p>
                      </div>
                    )}

                    {templates !== undefined && templates.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-3">
                          Select a template to pre-apply its constitution constraints to this project.
                        </p>
                        {/* None option */}
                        <label
                          className={`flex items-start gap-3 p-3 cursor-pointer border transition-colors ${
                            selectedTemplateId === null
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground"
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
                            <span className="text-sm font-semibold">No template</span>
                            <span className="text-xs text-muted-foreground">Start with a blank constitution</span>
                          </span>
                        </label>

                        {templates.map((template) => (
                          <label
                            key={template._id}
                            className={`flex items-start gap-3 p-3 cursor-pointer border transition-colors ${
                              selectedTemplateId === template._id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground"
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
                                <span className="text-sm font-semibold">{template.name}</span>
                                {template.usageCount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    Used {template.usageCount}×
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground mt-0.5">{template.description}</span>
                              {template.lockedConstraints?.architecture && (
                                <span className="text-xs text-muted-foreground mt-1">
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
              <div className="flex items-center justify-between pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {isValid ? "Ready to create your project" : "Fill in both fields to continue"}
                </p>
                <Button
                  onClick={onSubmit}
                  disabled={!isValid || isCreating}
                  className="min-w-[200px]"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </CardContent>
            </>
          )}
          </Card>
        </div>
      </div>

      {/* Decorative Watermark */}
      <div className="absolute bottom-0 left-0 right-0 max-w-full overflow-hidden text-[clamp(2.5rem,10vw,7.5rem)] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none truncate">
        CREATE
      </div>
    </main>
  );
}
