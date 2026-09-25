"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAction } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { generateAllQuestionAnswersAction, generatePhaseAction } from "@/lib/convex-actions";
import { ArrowRight, Shield, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConstitutionSchema } from "@/lib/validation/constitution-schema";
import type { ProjectMode } from "@/lib/workflow";

export interface ProjectRulesCardProps {
  projectId: string;
  constitutionContent?: string | null;
  mode?: ProjectMode | string;
  onDraftRules?: () => Promise<void> | void;
  className?: string;
}

export function ProjectRulesCard({
  projectId,
  constitutionContent,
  mode,
  onDraftRules,
  className,
}: ProjectRulesCardProps) {
  const [isDrafting, setIsDrafting] = useState(false);
  const generateAllQuestionAnswers = useAction(generateAllQuestionAnswersAction);
  const generatePhase = useAction(generatePhaseAction);

  let reviewCount: number | null = null;

  if (constitutionContent) {
    try {
      const raw = JSON.parse(constitutionContent);
      const parsed = ConstitutionSchema.safeParse(raw);
      if (parsed.success) {
        const register = parsed.data.decisionRegister ?? [];
        const count = register.filter(
          (entry) => entry.status === "proposed" || entry.status === "unresolved"
        ).length;
        if (count > 0) {
          reviewCount = count;
        }
      }
    } catch {
      // Invalid JSON or schema parsing failed -> show no count
    }
  }

  const reviewText =
    reviewCount !== null
      ? `${reviewCount} proposed ${reviewCount === 1 ? "rule needs" : "rules need"} review`
      : null;

  const canDraftRules = !constitutionContent && (mode === "full" || mode === "backend");

  async function handleDraftRules() {
    setIsDrafting(true);
    try {
      if (onDraftRules) {
        await onDraftRules();
      } else {
        await generateAllQuestionAnswers({
          projectId: projectId as Id<"projects">,
          phaseId: "constitution",
        });
        await generatePhase({
          projectId: projectId as Id<"projects">,
          phaseId: "constitution",
        });
      }
      toast.success("Drafting rules started");
    } catch (error) {
      toast.error("Failed to draft rules", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDrafting(false);
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Rules
            </span>
          </div>
          {reviewText && (
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-full">
              {reviewText}
            </span>
          )}
        </div>
        <CardTitle className="text-xl font-bold uppercase tracking-tight">
          Project Rules
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">
          Invariants, tech stack decisions, and architectural constraints.
        </CardDescription>
      </CardHeader>
      <CardFooter className="p-6 pt-0 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 mt-4">
        <Button asChild variant="outline">
          <Link href={`/project/${projectId}/phase/constitution` as Route}>
            View Project Rules
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
        {canDraftRules && (
          <Button
            variant="default"
            onClick={handleDraftRules}
            disabled={isDrafting}
          >
            {isDrafting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Drafting rules...
              </>
            ) : (
              "Draft rules"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
