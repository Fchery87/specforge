import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import type { CheckSource, CheckStatus } from "@/lib/verification/check";
import { CHECK_STATUS_WORDS, severityCounts, sourceLabel } from "@/lib/verification/words";
import { phaseLabel } from "@/lib/workflow";

export interface CheckListItem {
  _id: string;
  checkedAt: number;
  status: CheckStatus;
  outdatedAt?: number;
  source?: CheckSource;
  phaseId?: string;
  counts: { critical: number; major: number; minor: number };
}

export const CHECK_STATUS_TONE: Record<CheckStatus, string> = {
  pass: "text-success",
  warning: "text-warning",
  fail: "text-destructive",
};

/** A project's checks, newest first, each linked to its report. */
export function CheckList({ projectId, checks }: { projectId: string; checks: readonly CheckListItem[] }) {
  if (checks.length === 0) {
    return (
      <p className="text-ui text-dim">
        No checks yet. Check a pull request to see which requirements it meets and which it breaks.
      </p>
    );
  }

  return (
    <ul aria-label="Pull-request checks" className="divide-y divide-line">
      {checks.map((check) => {
        const counts = severityCounts(check.counts);
        const label = sourceLabel(check.source, check.phaseId ? phaseLabel(check.phaseId) : undefined);
        const date = new Date(check.checkedAt).toLocaleDateString();
        return (
          <li key={check._id}>
            <Link
              aria-label={`${label}: ${CHECK_STATUS_WORDS[check.status].toLowerCase()}, ${counts ?? "no problems"}${check.outdatedAt !== undefined ? ", outdated" : ""}, ${date}`}
              href={`/project/${projectId}/check/${check._id}` as Route}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 rounded-sm py-3 text-ui hover:bg-raised focus-ring sm:grid-cols-[5.5rem_minmax(0,1fr)_10rem_6rem]"
            >
              <span className={cn("font-medium", CHECK_STATUS_TONE[check.status])}>{CHECK_STATUS_WORDS[check.status]}</span>
              <span className="truncate text-ink">
                {label}
                {check.outdatedAt !== undefined && <span className="ml-2 text-caption text-dim">Outdated</span>}
              </span>
              <span className="col-start-2 text-dim sm:col-start-auto">{counts ?? "No problems"}</span>
              <span className="hidden text-right text-dim sm:block">{date}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
