"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, CheckCircle, XCircle, AlertTriangle, FileSearch } from "lucide-react";
import { toast } from "sonner";
import type { Finding, FindingCategory, FindingSeverity, VerificationStatus } from "@/lib/verification/spec-checker";

interface VerificationPanelProps {
  projectId: string;
  phaseId: string;
}

const categoryColors: Record<FindingCategory, string> = {
  bug: "bg-red-500/20 text-red-400 border-red-500/50",
  performance: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  security: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  clarity: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  missing: "bg-purple-500/20 text-purple-400 border-purple-500/50",
};

const severityColors: Record<FindingSeverity, string> = {
  critical: "bg-red-500 text-white",
  major: "bg-orange-500 text-white",
  minor: "bg-yellow-500 text-black",
};

const statusConfig: Record<VerificationStatus, { icon: typeof CheckCircle; label: string; color: string }> = {
  pass: { icon: CheckCircle, label: "Pass", color: "text-green-400" },
  fail: { icon: XCircle, label: "Fail", color: "text-red-400" },
  warning: { icon: AlertTriangle, label: "Warning", color: "text-yellow-400" },
};

export function VerificationPanel({ projectId, phaseId }: VerificationPanelProps) {
  const [gitDiff, setGitDiff] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{
    findings: Finding[];
    overallScore: number;
    status: VerificationStatus;
  } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verifyAction = useAction((api as any).actions?.verifyImplementation?.verifyImplementation as any);

  async function handleVerify() {
    if (!gitDiff.trim()) {
      toast.error("Please paste a git diff to verify");
      return;
    }

    setIsVerifying(true);
    const toastId = toast.message("Verifying implementation...", {
      description: "Comparing code changes against specifications",
    });

    try {
      const response = await verifyAction({
        projectId: projectId as unknown as import("@/convex/_generated/dataModel").Id<"projects">,
        phaseId,
        gitDiff: gitDiff.trim(),
      });

      setResult(response);
      toast.success("Verification complete", {
        id: toastId,
        description: `Score: ${response.overallScore}/100 (${response.status})`,
      });
    } catch (error) {
      toast.error("Verification failed", {
        id: toastId,
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <Card variant="static" className="border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSearch className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg normal-case tracking-normal">
              Implementation Verification
            </CardTitle>
          </div>
          {result && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  {result.overallScore}
                  <span className="text-base font-normal text-muted-foreground">/100</span>
                </div>
              </div>
              <StatusBadge status={result.status} />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <>
            <p className="text-sm text-muted-foreground">
              Paste your git diff to verify that your implementation matches the specification requirements.
            </p>
            <Textarea
              placeholder={`Paste git diff here...
Example:
diff --git a/src/app.ts b/src/app.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/app.ts
@@ -0,0 +1,50 @@
+import express from 'express';`}
              value={gitDiff}
              onChange={(e) => setGitDiff(e.target.value)}
              className="min-h-[200px] font-mono text-sm resize-y"
            />
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !gitDiff.trim()}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Implementation"
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            {result.findings.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  No issues found. Your implementation matches the specification.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  Found {result.findings.length} issue{result.findings.length !== 1 ? "s" : ""}
                </div>
                {result.findings.map((finding, index) => (
                  <FindingCard key={index} finding={finding} index={index} />
                ))}
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setGitDiff("");
              }}
              className="w-full"
            >
              Run Another Verification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={`${
        status === "pass" 
          ? "bg-green-500/20 text-green-400 border-green-500/50" 
          : status === "warning"
          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
          : "bg-red-500/20 text-red-400 border-red-500/50"
      } px-3 py-1`}
    >
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {config.label}
    </Badge>
  );
}

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  return (
    <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">
            #{index + 1}
          </span>
          <Badge variant="outline" className={`${categoryColors[finding.category]} text-xs`}>
            {finding.category.charAt(0).toUpperCase() + finding.category.slice(1)}
          </Badge>
          <Badge className={`${severityColors[finding.severity]} text-xs`}>
            {finding.severity.toUpperCase()}
          </Badge>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-sm mb-1">{finding.title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {finding.description}
        </p>
      </div>
      
      {finding.suggestion && (
        <div className="bg-white/5 rounded p-3 text-sm">
          <div className="font-medium text-xs text-muted-foreground mb-1">Suggestion:</div>
          <div className="text-sm">{finding.suggestion}</div>
        </div>
      )}
      
      {finding.specReference && (
        <div className="text-xs text-muted-foreground">
          Reference: <span className="font-mono">{finding.specReference}</span>
        </div>
      )}
    </div>
  );
}