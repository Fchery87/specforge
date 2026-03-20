"use client";

import { useState, useMemo } from "react";
import { Play, Sparkles, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { formatTokenCount, estimateCost } from "@/lib/llm/section-plans";
import type { SectionPlanConfig, UserSectionPreference } from "@/lib/llm/types";

interface SectionPlanPreviewProps {
  phaseId: string;
  phaseName: string;
  sectionPlans: SectionPlanConfig[];
  onGenerate: (preferences: UserSectionPreference[]) => void;
  isGenerating?: boolean;
  isLoadingPlan?: boolean;
  initialPreferences?: UserSectionPreference[];
}

export function SectionPlanPreview({
  phaseId,
  phaseName,
  sectionPlans,
  onGenerate,
  isGenerating = false,
  isLoadingPlan = false,
  initialPreferences,
}: SectionPlanPreviewProps) {
  // Initialize preferences
  const [preferences, setPreferences] = useState<UserSectionPreference[]>(() => {
    if (initialPreferences?.length) {
      return initialPreferences;
    }
    // Default: required sections enabled, optional disabled
    return sectionPlans.map((plan) => ({
      sectionId: plan.id,
      enabled: plan.required,
      customInstructions: "",
    }));
  });

  // Track expanded sections for instruction input
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Calculate totals
  const { enabledSections, totalTokens, estimatedCost } = useMemo(() => {
    const enabled = sectionPlans.filter((plan) => {
      const pref = preferences.find((p) => p.sectionId === plan.id);
      return pref?.enabled ?? plan.required;
    });
    const tokens = enabled.reduce((sum, plan) => sum + plan.estimatedTokens, 0);
    return {
      enabledSections: enabled,
      totalTokens: tokens,
      estimatedCost: estimateCost(tokens),
    };
  }, [sectionPlans, preferences]);

  // Check if any required sections are disabled
  const hasDisabledRequired = useMemo(() => {
    return sectionPlans.some(
      (plan) => plan.required && !preferences.find((p) => p.sectionId === plan.id)?.enabled
    );
  }, [sectionPlans, preferences]);

  // Toggle section enabled state
  const toggleSection = (sectionId: string) => {
    const plan = sectionPlans.find((p) => p.id === sectionId);
    if (!plan) return;

    // Don't allow disabling required sections
    if (plan.required) return;

    setPreferences((prev) =>
      prev.map((pref) =>
        pref.sectionId === sectionId
          ? { ...pref, enabled: !pref.enabled }
          : pref
      )
    );
  };

  // Update custom instructions
  const updateInstructions = (sectionId: string, instructions: string) => {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.sectionId === sectionId
          ? { ...pref, customInstructions: instructions }
          : pref
      )
    );
  };

  // Toggle expanded state
  const toggleExpanded = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Handle generate
  const handleGenerate = () => {
    onGenerate(preferences);
  };

  // Get section type icon
  const getSectionTypeIcon = (type: SectionPlanConfig["sectionType"]) => {
    switch (type) {
      case "technical":
        return "🔧";
      case "implementation":
        return "⚙️";
      case "planning":
        return "📋";
      case "documentation":
      default:
        return "📝";
    }
  };

  if (isLoadingPlan) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-4" role="status">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" aria-hidden="true" />
            <p aria-live="polite" className="text-sm text-muted-foreground">Generating section plan...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Review Generation Plan</CardTitle>
              <CardDescription>
                Toggle sections on/off and add custom instructions before generating {phaseName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Estimate */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated Tokens</span>
              <span className="font-medium">{formatTokenCount(totalTokens)}</span>
            </div>
            <Progress value={(enabledSections.length / sectionPlans.length) * 100} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {enabledSections.length} of {sectionPlans.length} sections enabled
              </span>
              <span className="text-muted-foreground">Est. cost: {estimatedCost}</span>
            </div>          </div>

          {/* Warning if required sections disabled */}
          {hasDisabledRequired && (
            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <strong>Required sections disabled</strong>
                <p className="mt-1">
                  Some required sections are disabled. The generation may be incomplete.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section Plans */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {sectionPlans.map((plan) => {
            const pref = preferences.find((p) => p.sectionId === plan.id);
            const isEnabled = pref?.enabled ?? plan.required;
            const isExpanded = expandedSections.has(plan.id);

            return (
              <Card
                key={plan.id}
                className={`transition-all ${
                  isEnabled ? "border-primary/20" : "opacity-60"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Toggle Button */}
                    <button
                      onClick={() => toggleSection(plan.id)}
                      disabled={plan.required || isGenerating}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isEnabled
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30 hover:border-muted-foreground"
                      } ${plan.required ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {isEnabled && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getSectionTypeIcon(plan.sectionType)}</span>
                        <h3 className="font-medium">{plan.title}</h3>
                        {plan.required && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                        {!isEnabled && (
                          <Badge variant="outline" className="text-xs">Skipped</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {plan.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatTokenCount(plan.estimatedTokens)} tokens</span>
                        <button
                          onClick={() => toggleExpanded(plan.id)}
                          className="text-primary hover:underline"
                        >
                          {isExpanded ? "Hide instructions" : "Add custom instructions"}
                        </button>
                      </div>

                      {/* Custom Instructions Input */}
                      {isExpanded && (
                        <div className="mt-3">
                          <Textarea
                            placeholder={`Add specific instructions for the "${plan.title}" section...`}
                            value={pref?.customInstructions || ""}
                            onChange={(e) => updateInstructions(plan.id, e.target.value)}
                            disabled={!isEnabled || isGenerating}
                            className="text-sm min-h-[80px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || enabledSections.length === 0}
        className="w-full h-14 text-lg"
        size="lg"
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
            Generating...
          </>
        ) : (
          <>
            <Play className="w-5 h-5 mr-2" />
            Generate {enabledSections.length} Section
            {enabledSections.length !== 1 ? "s" : ""} ({formatTokenCount(totalTokens)} tokens)
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Skeleton loader for SectionPlanPreview
 */
export function SectionPlanPreviewSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3 mt-2"></div>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded"></div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-5 h-5 bg-muted rounded mt-1"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
