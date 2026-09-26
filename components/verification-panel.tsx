"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { verifyImplementationAction } from "@/lib/convex-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, AlertTriangle, FileSearch, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { Finding, FindingCategory, FindingSeverity, VerificationStatus } from "@/lib/verification/spec-checker";
import type { Id } from "@/convex/_generated/dataModel";

interface VerificationPanelProps {
  projectId: string;
  phaseId: string;
}

const categoryColors: Record<FindingCategory, string> = {
  bug: "bg-brick/20 text-brick border-brick/50",
  performance: "bg-amber/20 text-amber border-amber/50",
  security: "bg-amber/20 text-amber border-amber/50",
  clarity: "bg-slate/20 text-slate border-slate/50",
  missing: "bg-slate/20 text-slate border-slate/50",
};

const severityColors: Record<FindingSeverity, string> = {
  critical: "bg-brick/15 text-brick border-brick/40",
  major: "bg-amber/15 text-amber border-amber/40",
  minor: "bg-slate/15 text-slate border-slate/40",
};

const statusConfig: Record<VerificationStatus, { icon: typeof CheckCircle; label: string; color: string }> = {
  pass: { icon: CheckCircle, label: "Pass", color: "text-sage" },
  fail: { icon: XCircle, label: "Fail", color: "text-brick" },
  warning: { icon: AlertTriangle, label: "Warning", color: "text-amber" },
};

export function VerificationPanel({ projectId, phaseId }: VerificationPanelProps) {
  const [gitDiff, setGitDiff] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [result, setResult] = useState<{
    findings: Finding[];
    overallScore: number;
    status: VerificationStatus;
  } | null>(null);

  const verifyAction = useAction(verifyImplementationAction);
  const verificationHistory = useQuery(api.evidence.listVerificationResults, {
    projectId: projectId as Id<"projects">,
  });

  async function handleCopyCommand() {
    const command = "git diff origin/main...HEAD";
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(true);
      toast.success("Copied to clipboard", {
        description: command,
      });
      setTimeout(() => setCopiedCommand(false), 2000);
    } catch {
      toast.error("Failed to copy command to clipboard");
    }
  }

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
            <FileSearch className="size-5 text-muted-foreground" />
            <CardTitle className="text-title">
              Implementation Verification
            </CardTitle>
          </div>
          {result && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-title font-bold tabular-nums">
                  {result.overallScore}
                  <span className="text-body font-normal text-muted-foreground">/100</span>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-ui text-muted-foreground">
                Paste your git diff to verify implementation against requirements.
              </p>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="inline-flex items-center gap-1.5 font-mono text-caption bg-raised/60 hover:bg-raised text-ink border border-line rounded-sm px-2.5 py-1 transition-colors self-start sm:self-auto shrink-0"
                title="Copy git diff command: git diff origin/main...HEAD"
              >
                {copiedCommand ? (
                  <Check className="size-3.5 text-sage" />
                ) : (
                  <Copy className="size-3.5 text-muted-foreground" />
                )}
                <span>{copiedCommand ? "Copied command" : "Copy diff command"}</span>
              </button>
            </div>
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
              className="min-h-[200px] font-mono text-ui resize-y"
            />
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !gitDiff.trim()}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
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
                <div className="inline-flex items-center justify-center size-16 rounded-full bg-sage/20 mb-4">
                  <CheckCircle className="size-8 text-sage" />
                </div>
                <h3 className="text-title font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  No issues found. Your implementation matches the specification.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-ui font-medium">
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
        {verificationHistory && verificationHistory.length > 0 && (
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-ui font-semibold">Previous checks</h3>
            <ul className="space-y-2">
              {verificationHistory.map((item) => (
                <li key={item._id} className="flex flex-wrap items-center justify-between gap-2 text-caption">
                  <span>{new Date(item.checkedAt).toLocaleString()} · {item.overallScore}/100 · {item.artifactVersionSet?.length ? `${item.artifactVersionSet.length} artifact revision${item.artifactVersionSet.length === 1 ? '' : 's'}` : `artifact v${item.artifactVersion ?? "?"}`}</span>
                  {item.outdatedAt ? <Badge variant="outline">Outdated</Badge> : <StatusBadge status={item.status} />}
                </li>
              ))}
            </ul>
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
          ? "bg-sage/20 text-sage border-sage/50" 
          : status === "warning"
          ? "bg-amber/20 text-amber border-amber/50"
          : "bg-brick/20 text-brick border-brick/50"
      } px-3 py-1`}
    >
      <Icon className="size-3.5 mr-1.5" />
      {config.label}
    </Badge>
  );
}

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  return (
    <div className="border border-line/50 rounded-lg p-4 space-y-3 bg-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-muted-foreground font-mono">
            #{index + 1}
          </span>
          <Badge variant="outline" className={`${categoryColors[finding.category]} text-caption`}>
            {finding.category.charAt(0).toUpperCase() + finding.category.slice(1)}
          </Badge>
          <Badge className={`${severityColors[finding.severity]} text-caption`}>
            {finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)}
          </Badge>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-ui mb-1">{finding.title}</h4>
        <p className="text-ui text-muted-foreground leading-relaxed">
          {finding.description}
        </p>
      </div>
      
      {finding.suggestion && (
        <div className="bg-ink/5 rounded-sm p-3 text-ui">
          <div className="font-medium text-caption text-muted-foreground mb-1">Suggestion</div>
          <div className="text-ui">{finding.suggestion}</div>
        </div>
      )}
      
      {finding.specReference && (
        <div className="text-caption text-muted-foreground">
          Reference <span className="font-mono">{finding.specReference}</span>
        </div>
      )}
      {finding.requirementId && (
        <div className="text-caption text-muted-foreground">Requirement <span className="font-mono">{finding.requirementId}</span></div>
      )}
      {finding.changedFilePath && (
        <div className="text-caption text-muted-foreground">Changed file <span className="font-mono">{finding.changedFilePath}</span></div>
      )}
    </div>
  );
}
