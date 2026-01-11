"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.createProject);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const titleLeft = 100 - title.length;
  const descLeft = 5000 - description.length;
  const isValid = title.trim().length > 0 && description.trim().length > 0;

  async function onSubmit() {
    if (!isValid || isCreating) return;
    setIsCreating(true);
    try {
      const id = await createProject({ 
        title: title.slice(0, 100), 
        description: description.slice(0, 5000) 
      });
      router.push(`/project/${id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      setIsCreating(false);
    }
  }

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
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Project Description
                </label>
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
