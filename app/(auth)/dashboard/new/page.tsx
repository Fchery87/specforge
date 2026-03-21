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
import { ArrowLeft, BookTemplate, ChevronDown, ChevronUp, Loader2, Sparkles, Github } from "lucide-react";
import Link from "next/link";
import { PromptEnhanceButton } from "@/components/prompt-enhance-button";
import { CodebaseConnector } from "@/components/codebase-connector";
import { toast } from "sonner";

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.createProject);
  const incrementUsageCount = useMutation(api.constitutionTemplates.incrementUsageCount);
  const templates = useQuery(api.constitutionTemplates.listTemplates);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<Id<"constitutionTemplates"> | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [showRepoConnector, setShowRepoConnector] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<Id<"projects"> | null>(null);

  const titleLeft = 100 - title.length;
  const descLeft = 5000 - description.length;
  const isValid = title.trim().length > 0 && description.trim().length > 0;

  async function onSubmit() {
    if (!isValid || isCreating) return;
    setIsCreating(true);
    try {
      // TODO: Pass selectedTemplateId to createProject once the mutation supports it.
      // For now the selected template is stored locally and usage is tracked below.
      const id = await createProject({
        title: title.slice(0, 100),
        description: description.slice(0, 5000),
      });
      if (selectedTemplateId) {
        await incrementUsageCount({ templateId: selectedTemplateId });
      }
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
      router.push(`/project/${createdProjectId}`);
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
              Give your project a name and describe what you want to create. Be detailed—the more context, the better the output.
            </p>
          </div>

          {/* Form Card */}
          <Card variant="static" className="border-2">
            {showRepoConnector && createdProjectId ? (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary flex items-center justify-center">
                      <Github className="w-5 h-5 text-black" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Step 2 of 2
                    </span>
                  </div>
                  <CardTitle className="text-xl normal-case tracking-normal font-semibold">
                    Connect Your Repository
                  </CardTitle>
                  <CardDescription>
                    Link a GitHub repository to enable codebase-aware specification generation. This helps SpecForge understand your existing code structure and patterns.
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
                      Skip this step →
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-xl normal-case tracking-normal font-semibold">Project Details</CardTitle>
              <CardDescription>
                Title (max 100 chars) and description (max 5,000 chars)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Title Input - Hero Style */}
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Project Title
                </label>
                <Input
                  inputSize="hero"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="My Awesome Project"
                  disabled={isCreating}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Make it memorable</span>
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
                  />
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                  placeholder="Describe your project in detail. What problem does it solve? Who is the target audience? What are the key features you envision? Include any technical requirements, integrations, or constraints..."
                  className="min-h-[200px] text-base"
                  disabled={isCreating}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Be as detailed as possible</span>
                  <span className={descLeft < 500 ? "text-warning" : "text-muted-foreground"}>
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

      {/* Decorative Element */}
      <div className="absolute bottom-0 left-0 right-0 text-[20vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        CREATE
      </div>
    </main>
  );
}
