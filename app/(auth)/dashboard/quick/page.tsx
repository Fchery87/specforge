"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Loader2, Zap } from "lucide-react";
import { MermaidAwareContent } from "@/components/ui/mermaid-aware-content";

export default function QuickSpecPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quickSpecRef = (api as any)["actions/generateQuickSpec"]?.generateQuickSpec;
  const generateQuickSpec = useAction(quickSpecRef);

  async function handleGenerate() {
    if (!title.trim() || !description.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateQuickSpec({
        title: title.trim(),
        description: description.trim(),
      });
      setResult(res.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
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
          Generate a Spec
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Describe your task and get a focused spec with architecture decisions,
          implementation steps, and a diagram.
        </p>
      </section>

      <section className="page-container page-section border-t-2 border-border relative z-10">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Form */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
                Task Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Add OAuth login with Google"
                className="w-full bg-secondary/30 border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-semibold uppercase tracking-widest text-muted-foreground block mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to build, any constraints, and the tech stack..."
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
              {isGenerating ? "Generating…" : "Generate Spec"}
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
                  <CardDescription>Quick Spec Result</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
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
                  <p className="text-sm">Your spec will appear here</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
