import Link from "next/link";
import type { Route } from "next";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CheckCoverage,
  CheckSource,
  CheckStatus,
  OtherFinding,
  RequirementVerdict,
  Severity,
} from "@/lib/verification/check";
import {
  CHECK_STATUS_WORDS,
  SCOPE_WORDS,
  SEVERITY_WORDS,
  VERDICT_WORDS,
  quoteUrl,
  severityCounts,
  sourceLabel,
} from "@/lib/verification/words";
import { phaseLabel } from "@/lib/workflow";
import { CHECK_STATUS_TONE } from "./check-list";

export interface ReportRequirement {
  text: string;
  phaseId: string;
  decisionStatus: string;
  reviewStatus: "current" | "needs_review";
  retired: boolean;
}

/** A finding from the check made before phase 8, which judged a pasted diff against one phase. */
export interface LegacyFinding {
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
}

export interface ReportCheck {
  checkedAt: number;
  status: CheckStatus;
  outdatedAt?: number;
  phaseId?: string;
  source?: CheckSource;
  verdicts?: RequirementVerdict[];
  coverage?: CheckCoverage;
  otherFindings?: OtherFinding[];
  notes?: string[];
  findings: LegacyFinding[];
}

const VERDICT_TONE: Record<RequirementVerdict["verdict"], string> = {
  violated: "text-destructive",
  incomplete: "text-warning",
  not_shown: "text-dim",
  met: "text-success",
};

function countBySeverity(severities: Array<Severity | null>) {
  const count = (severity: Severity) => severities.filter((value) => value === severity).length;
  return { critical: count("critical"), major: count("major"), minor: count("minor") };
}

function VerdictItem({
  projectId,
  verdict,
  requirement,
  repositoryUrl,
  source,
}: {
  projectId: string;
  verdict: RequirementVerdict;
  requirement: ReportRequirement | undefined;
  repositoryUrl: string | null;
  source: CheckSource | undefined;
}) {
  const unconfirmed = verdict.severity !== null && requirement && !requirement.retired && requirement.decisionStatus !== "confirmed";
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-caption text-dim">{verdict.claimId}</span>
        <span className={cn("text-ui font-medium", VERDICT_TONE[verdict.verdict])}>
          {VERDICT_WORDS[verdict.verdict]}
          {verdict.severity ? `, ${SEVERITY_WORDS[verdict.severity].toLowerCase()}` : ""}
        </span>
        <span className="text-caption text-dim">{SCOPE_WORDS[verdict.scope]}</span>
      </div>
      <p className="mt-2 max-w-2xl text-body text-ink">
        {requirement ? requirement.text : "This requirement is no longer in the project."}
        {requirement?.retired ? <span className="ml-2 text-caption text-dim">Retired since this check</span> : null}
      </p>
      <p className="mt-2 max-w-2xl text-ui text-muted-foreground">{verdict.explanation}</p>
      {verdict.evidence.length ? (
        <ul className="mt-3 grid gap-2 *:min-w-0" aria-label={`Lines ${verdict.claimId} rests on`}>
          {verdict.evidence.map((quote, index) => {
            const url = quoteUrl(repositoryUrl, source, quote);
            const where = `${quote.path}${quote.line ? `:${quote.line}` : ""}`;
            return (
              <li key={index} className="rounded-sm border border-line bg-raised/50">
                <div className="border-b border-line px-3 py-1.5 text-caption text-dim">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:text-ink focus-ring">
                      {where}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  ) : (
                    <span className="font-mono">{where}</span>
                  )}
                </div>
                <pre className="overflow-x-auto px-3 py-2 font-mono text-caption text-ink">{quote.quote}</pre>
              </li>
            );
          })}
        </ul>
      ) : null}
      {unconfirmed ? (
        <p className="mt-3 max-w-2xl text-caption text-dim">
          {verdict.claimId} is still {requirement.decisionStatus}, so this is graded {SEVERITY_WORDS[verdict.severity!].toLowerCase()}.
          Confirmed requirements are graded one step more severely.{" "}
          <Link href={`/project/${projectId}/phase/${requirement.phaseId}` as Route} className="text-ink underline underline-offset-2 focus-ring">
            Confirm it on the {phaseLabel(requirement.phaseId)} page
          </Link>{" "}
          if it is settled.
        </p>
      ) : null}
    </li>
  );
}

/** A check's outcome: each requirement's verdict with the lines it rests on, and what was not read. */
export function CheckReport({
  projectId,
  check,
  requirements,
  repositoryUrl,
}: {
  projectId: string;
  check: ReportCheck;
  requirements: Record<string, ReportRequirement>;
  repositoryUrl: string | null;
}) {
  const legacy = check.verdicts === undefined;
  const counts = severityCounts(
    countBySeverity(legacy ? check.findings.map((finding) => finding.severity) : check.verdicts!.map((verdict) => verdict.severity)),
  );
  const skipped = check.coverage?.skippedFiles ?? [];
  const reviewedCount = check.coverage?.reviewedFiles.length ?? 0;

  return (
    <div className="grid gap-8 *:min-w-0">
      <div>
        <p className={cn("font-display text-title font-semibold", CHECK_STATUS_TONE[check.status])}>
          {CHECK_STATUS_WORDS[check.status]}
          <span className="ml-3 text-ui font-normal text-muted-foreground">{counts ?? "No problems found"}</span>
        </p>
        <p className="mt-2 text-ui text-muted-foreground">
          {check.source?.kind === "pull_request" ? (
            <a href={check.source.url} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2 focus-ring">
              {sourceLabel(check.source)}
            </a>
          ) : (
            sourceLabel(check.source, check.phaseId ? phaseLabel(check.phaseId) : undefined)
          )}
          {", checked "}
          {new Date(check.checkedAt).toLocaleString()}
          {legacy ? "" : `. Read ${reviewedCount} ${reviewedCount === 1 ? "file" : "files"}${skipped.length ? `, skipped ${skipped.length}` : ""}.`}
        </p>
      </div>

      {check.outdatedAt !== undefined ? (
        <p role="status" className="rounded-sm border border-warning/40 bg-warning/5 px-4 py-3 text-ui text-ink">
          Requirements or documents changed after this check. Run it again for a current verdict.
        </p>
      ) : null}

      {legacy ? (
        <section aria-labelledby="legacy-heading">
          <h2 id="legacy-heading" className="text-title font-medium text-ink">Findings</h2>
          <p className="mt-1 text-ui text-dim">Made by the earlier check, which judged a pasted diff without requirement verdicts.</p>
          <ul className="mt-3 divide-y divide-line">
            {check.findings.map((finding, index) => (
              <li key={index} className="py-4">
                <p className="text-ui font-medium text-ink">
                  {finding.title} <span className="font-normal text-dim">{SEVERITY_WORDS[finding.severity]}</span>
                </p>
                <p className="mt-1 text-ui text-muted-foreground">{finding.description}</p>
                {finding.suggestion ? <p className="mt-1 text-ui text-muted-foreground">{finding.suggestion}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-labelledby="verdicts-heading">
          <h2 id="verdicts-heading" className="text-title font-medium text-ink">Requirements</h2>
          {check.verdicts!.length === 0 ? (
            <p className="mt-2 text-ui text-dim">The check found no requirement this change touches.</p>
          ) : (
            <ul className="divide-y divide-line">
              {check.verdicts!.map((verdict) => (
                <VerdictItem
                  key={verdict.claimId}
                  projectId={projectId}
                  verdict={verdict}
                  requirement={requirements[verdict.claimId]}
                  repositoryUrl={repositoryUrl}
                  source={check.source}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {skipped.length ? (
        <section aria-labelledby="skipped-heading">
          <h2 id="skipped-heading" className="text-title font-medium text-ink">Not read</h2>
          <p className="mt-1 text-ui text-dim">The check cannot vouch for these files, so a pass becomes a warning.</p>
          <ul className="mt-3 grid gap-1.5">
            {skipped.map((file) => (
              <li key={file.path} className="flex flex-wrap items-baseline gap-x-3 text-ui">
                <span className="font-mono text-caption text-ink">{file.path}</span>
                <span className="text-caption text-dim">{file.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {check.otherFindings?.length ? (
        <section aria-labelledby="other-heading">
          <h2 id="other-heading" className="text-title font-medium text-ink">Other problems</h2>
          <p className="mt-1 text-ui text-dim">Noticed in the diff but tied to no requirement, so they do not change the result.</p>
          <ul className="mt-3 divide-y divide-line">
            {check.otherFindings.map((finding, index) => (
              <li key={index} className="py-3">
                <p className="text-ui font-medium text-ink">
                  {finding.title} <span className="font-normal capitalize text-dim">{finding.category}</span>
                </p>
                <p className="mt-1 text-ui text-muted-foreground">
                  {finding.path ? <span className="mr-2 font-mono text-caption">{finding.path}</span> : null}
                  {finding.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {check.notes?.length ? (
        <section aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="text-title font-medium text-ink">Notes</h2>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-ui text-muted-foreground">
            {check.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
