import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SpecClause,
  SpecDocument,
  SpecSectionHeading,
  type EvidenceItem,
} from "@/components/spec-document";

const heroEvidence: EvidenceItem[] = [
  { kind: "Interview", source: "Who may archive a project", pin: "2026-09-22" },
  { kind: "File", source: "lib/authz.ts", pin: "4f2a91c" },
];

const stages = [
  {
    index: "01",
    label: "Requirements",
    summary: "What to build, and why",
    phases: [
      { label: "Brief", state: "Confirmed", tone: "text-success" },
      { label: "PRD", state: "Needs review", tone: "text-warning" },
    ],
  },
  {
    index: "02",
    label: "Design",
    summary: "How it is shaped",
    phases: [
      { label: "Domain model", state: "Draft", tone: "text-dim" },
      { label: "Architecture", state: "Not started", tone: "text-dim" },
      { label: "Schemas", state: "Not started", tone: "text-dim" },
    ],
  },
  {
    index: "03",
    label: "Tasks",
    summary: "What to build first",
    phases: [{ label: "Tasks", state: "Not started", tone: "text-dim" }],
  },
];

const capabilities = [
  {
    label: "Evidence-backed claims",
    detail:
      "Every requirement carries a claim ID and a link to the interview answer, rule, or commit that justifies it. Change the code, and the spec tells you which claims went stale.",
  },
  {
    label: "Vertical tracer bullets",
    detail:
      "Tasks break into end-to-end slices with explicit blocking edges, so the build order is derived rather than guessed.",
  },
  {
    label: "Stress-test grilling",
    detail:
      "Each stage runs up to ten failure-mode questions before generation. Race conditions and boundary rules are settled in the spec, not discovered in review.",
  },
  {
    label: "Schema validation in the browser",
    detail:
      "Paste a JSON or YAML contract and see the break highlighted before an agent builds against it.",
  },
  {
    label: "Agent-native handoff",
    detail:
      "Export a ZIP, an AGENTS.md rules file, and a SKILL.md build guide written for Claude Code, Cursor, and Codex.",
  },
  {
    label: "Repo-aware evidence",
    detail:
      "Connect a GitHub repository so evidence can cite files pinned at a commit instead of quoting a document nobody updated.",
  },
];

/**
 * The hero's stage band: finished segments in ink, the current one part-filled in the brand colour,
 * the rest as hairline tracks. Each group is one stage, so a group's width follows its phase count.
 */
const bandGroups = [
  { label: "Rules", segments: ["done"] },
  { label: "Requirements", segments: ["done", "done"] },
  { label: "Design", segments: ["now", "todo", "todo"], current: true },
  { label: "Tasks", segments: ["todo"] },
  { label: "Export", segments: ["todo"] },
] as const;

function StageBand() {
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="grid animate-band-wipe grid-cols-[1fr_2fr_3fr_1fr_1fr] gap-3">
        {bandGroups.map((group) => (
          <div key={group.label} className="grid auto-cols-fr grid-flow-col gap-1">
            {group.segments.map((segment, index) => (
              <span
                key={index}
                className={cn(
                  "relative h-1.5 overflow-hidden rounded-full",
                  segment === "done" ? "bg-ink" : "bg-line"
                )}
              >
                {segment === "now" && (
                  <span className="absolute inset-y-0 left-0 w-[45%] rounded-full bg-brand" />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-[1fr_2fr_3fr_1fr_1fr] gap-3 text-caption">
        {bandGroups.map((group) => (
          <span
            key={group.label}
            className={cn(
              "truncate",
              "current" in group ? "font-medium text-ink" : "invisible text-dim sm:visible"
            )}
          >
            {group.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-line">
        <div className="page-container pt-16 md:pt-24">
          <h1 className="max-w-[15ch] font-display text-display font-semibold text-ink">
            Every requirement shows its proof.
          </h1>

          <div className="mt-9 grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10">
            <div>
              <p className="max-w-[60ch] text-prose text-muted-foreground">
                SpecForge turns a product brief into a specification where each clause is traced to
                the answer, rule, or commit behind it. Your coding agent builds from the spec. You
                review the evidence.
              </p>
              <p className="mt-3 text-label text-dim">
                Bring your own model. Review between stages, or run all of them in one pass.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">Start a spec</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dashboard/quick">Try a quick spec</Link>
              </Button>
            </div>
          </div>

          <div
            aria-label="Example specification"
            className="mt-14 animate-sheet-rise rounded-t-lg border border-b-0 border-line bg-surface px-5 pt-6 md:mt-16 md:px-10"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-label text-dim">
              <span>
                <span className="font-medium text-ink">Atlas</span> product requirements, revision 3
              </span>
              <span>Design stage, domain model generating</span>
            </div>

            <StageBand />

            <SpecDocument className="mt-8 border-t border-line pt-8 pb-10">
              <SpecSectionHeading number="3.3" title="Roles and permissions" />
              <SpecClause number="3.3.1" claimId="C-014" state="confirmed" evidence={heroEvidence}>
                <p>
                  A workspace member with the editor role may archive a project. Archiving sets the
                  project status to archived, keeps every artifact readable, and writes one audit
                  event. An archived project accepts no new generation runs.
                </p>
              </SpecClause>

              <SpecClause number="3.3.2" claimId="C-015" state="untraced">
                <p>
                  Restoring an archived project requires an owner and produces the same audit event
                  as archiving.
                </p>
              </SpecClause>
            </SpecDocument>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="page-container py-16 md:py-20">
          <h2 className="text-heading font-display font-semibold text-ink">
            Three stages, eight phases
          </h2>
          <p className="mt-4 max-w-xl text-body leading-relaxed text-muted-foreground">
            Project rules hold across every stage. Each stage runs its own question round, generates
            its artifacts, and stops for review where you asked it to.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-4">
            <span className="text-label text-dim">Always available</span>
            <span className="text-ui text-ink">Project rules</span>
            <span className="text-label text-dim">Handoff</span>
            <span className="text-ui text-ink">Export</span>
          </div>

          <div className="mt-px grid gap-px bg-line md:grid-cols-3">
            {stages.map((stage) => (
              <div key={stage.index} className="bg-void py-6 md:px-6 md:first:pl-0 md:last:pr-0">
                <p className="font-mono text-caption tabular-nums text-brand">{stage.index}</p>
                <h3 className="mt-2 text-title font-medium text-ink">{stage.label}</h3>
                <p className="mt-1 text-label text-dim">{stage.summary}</p>

                <ul className="mt-5 flex flex-col">
                  {stage.phases.map((phase) => (
                    <li
                      key={phase.label}
                      className="flex items-baseline justify-between gap-4 border-t border-line py-2.5"
                    >
                      <span className="text-ui text-ink">{phase.label}</span>
                      <span className={`text-label ${phase.tone}`}>{phase.state}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="page-container py-16 md:py-20">
          <h2 className="text-heading font-display font-semibold text-ink">
            What makes the spec hold
          </h2>

          <dl className="mt-10 grid gap-x-16 md:grid-cols-2">
            {capabilities.map((capability) => (
              <div
                key={capability.label}
                className="border-t border-line py-5"
              >
                <dt className="text-body font-medium text-ink">{capability.label}</dt>
                <dd className="mt-2 max-w-lg text-ui leading-relaxed text-muted-foreground">
                  {capability.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <div className="page-container flex flex-col items-start gap-6 py-20 md:flex-row md:items-center md:justify-between md:py-24">
          <div>
            <h2 className="max-w-2xl text-heading font-display font-semibold text-ink">
              Bring a brief. Leave with a spec your agent can build from.
            </h2>
            <p className="mt-4 max-w-xl text-body leading-relaxed text-muted-foreground">
              Start with a title and a paragraph. SpecForge asks what it needs to know before it
              writes anything.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/dashboard">Start a spec</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
