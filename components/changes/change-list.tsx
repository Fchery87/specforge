import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import {
  CHANGE_KIND_WORDS,
  CHANGE_STATUS_WORDS,
  formatChangeId,
  type ChangeKind,
  type ChangeStatus,
} from "@/lib/changes/format";

export interface ChangeListItem {
  _id: string;
  changeNumber: number;
  kind: ChangeKind;
  title: string;
  status: ChangeStatus;
}

const STATUS_TONE: Record<ChangeStatus, string> = {
  draft: "text-warning",
  applied: "text-muted-foreground",
  abandoned: "text-dim",
};

/** A project's changes, newest first, each linked to its page. */
export function ChangeList({ projectId, changes }: { projectId: string; changes: readonly ChangeListItem[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-ui text-dim">
        No changes yet. Start one when the product needs to change or a bug needs fixing.
      </p>
    );
  }

  return (
    <ul aria-label="Changes" className="divide-y divide-line">
      {changes.map((change) => (
        <li key={change._id}>
          <Link
            href={`/project/${projectId}/change/${change._id}` as Route}
            className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-baseline gap-4 rounded-sm py-3 text-ui hover:bg-raised focus-ring sm:grid-cols-[6rem_minmax(0,1fr)_8rem_6rem]"
          >
            <span className="font-mono text-caption text-dim">{formatChangeId(change.changeNumber)}</span>
            <span className="truncate text-ink">{change.title}</span>
            <span className="hidden text-dim sm:block">{CHANGE_KIND_WORDS[change.kind]}</span>
            <span className={cn("text-right", STATUS_TONE[change.status])}>{CHANGE_STATUS_WORDS[change.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
