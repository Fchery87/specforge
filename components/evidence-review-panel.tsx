"use client";

import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Link2, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

type ClaimKind = 'decision' | 'requirement' | 'acceptance_criterion';
type DecisionStatus = 'confirmed' | 'observed' | 'proposed' | 'unresolved';

export function EvidenceReviewPanel({
  projectId,
  artifactId,
}: {
  projectId: Id<'projects'>;
  artifactId: Id<'artifacts'>;
}) {
  const workspace = useQuery(api.evidence.listWorkspace, { projectId, artifactId });
  const createClaim = useMutation(api.evidence.createClaim);
  const addNote = useMutation(api.evidence.addNote);
  const reviewClaim = useMutation(api.evidence.reviewClaim);
  const reviewLink = useMutation(api.evidence.reviewEvidenceLink);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<ClaimKind>('requirement');
  const [decisionStatus, setDecisionStatus] = useState<DecisionStatus>('proposed');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [claimEdits, setClaimEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreateClaim(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await createClaim({
        projectId,
        artifactId,
        text: text.trim(),
        kind,
        decisionStatus,
        sourceIds: selectedSourceIds as Id<'evidenceSources'>[],
      });
      setText('');
      setSelectedSourceIds([]);
      toast.success('Requirement added for evidence review');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add requirement');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addNote({ projectId, note: note.trim() });
      setNote('');
      toast.success('Evidence note captured');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save evidence note');
    } finally {
      setBusy(false);
    }
  }

  async function runReview(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Review could not be saved');
    }
  }

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4" /> Requirements and evidence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {workspace?.claims.map((claim) => (
          <div key={claim._id} className="border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{claim.claimId}</strong>
              <span className={claim.reviewStatus === 'needs_review' ? 'text-amber-600' : 'text-muted-foreground'}>
                {claim.decisionStatus} · {claim.reviewStatus.replace('_', ' ')}
              </span>
            </div>
            <textarea
              aria-label={`Requirement text ${claim.claimId}`}
              value={claimEdits[claim._id] ?? claim.text}
              onChange={(event) => setClaimEdits((current) => ({ ...current, [claim._id]: event.target.value }))}
              maxLength={4000}
              rows={2}
              className="mt-2 w-full border border-border bg-background p-2"
            />
            {claimEdits[claim._id] !== undefined && claimEdits[claim._id].trim() !== claim.text && (
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={() => void runReview(
                  () => reviewClaim({ claimId: claim._id, action: 'revised', text: claimEdits[claim._id] }),
                  'Requirement text updated; its ID was preserved',
                )}
              >Save wording</Button>
            )}
            <div className="mt-2 space-y-2">
              {claim.links.map((link) => (
                <div key={link._id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {link.source ? (
                      link.source.kind === 'repository_file' && link.source.commitSha ? (
                        <a
                          className="underline"
                          href={repositorySourceUrl(link.source.sourceKey, link.source.commitSha)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >{link.source.revisionLabel} · {link.source.locator} · {link.supportStatus}</a>
                      ) : link.source.kind === 'answer' ? (
                        <a
                          className="underline"
                          href={`/project/${encodeURIComponent(projectId)}/phase/${encodeURIComponent(link.source.locator.split('/')[0] ?? '')}`}
                        >{link.source.revisionLabel} · {link.source.locator} · {link.supportStatus}</a>
                      ) : (
                        <span>{link.source.revisionLabel} · {link.source.locator} · {link.supportStatus}</span>
                      )
                    ) : 'Missing source'}
                    {link.source?.excerpt ? <span className="block mt-1">“{link.source.excerpt}”</span> : null}
                  </span>
                  {link.supportStatus === 'suggested' && (
                    <span className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void runReview(() => reviewLink({ linkId: link._id, supportStatus: 'confirmed' }), 'Evidence link confirmed')}>
                        <Check className="mr-1 h-3 w-3" /> Supports
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void runReview(() => reviewLink({ linkId: link._id, supportStatus: 'rejected' }), 'Evidence link rejected')}>
                        Reject
                      </Button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            {claim.reviewStatus === 'needs_review' && (
              <span className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runReview(() => reviewClaim({ claimId: claim._id, action: 'confirmed', decisionStatus: 'confirmed' }), 'Requirement confirmed')}
                >
                  <Check className="mr-1 h-3 w-3" /> Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void runReview(() => reviewClaim({ claimId: claim._id, action: 'unresolved', decisionStatus: 'unresolved' }), 'Requirement marked unresolved')}
                >Leave unresolved</Button>
              </span>
            )}
          </div>
        ))}

        <form className="space-y-2 border-t border-border pt-3" onSubmit={handleCreateClaim}>
          <label className="block text-xs font-semibold uppercase tracking-wide" htmlFor={`claim-text-${artifactId}`}>Add requirement or decision</label>
          <textarea
            id={`claim-text-${artifactId}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={4000}
            rows={2}
            className="w-full border border-border bg-background p-2 text-sm"
            placeholder="Write one reviewable requirement or decision"
          />
          <div className="flex flex-wrap gap-2">
            <select aria-label="Requirement type" value={kind} onChange={(event) => setKind(event.target.value as ClaimKind)} className="border border-border bg-background px-2 py-1 text-xs">
              <option value="requirement">Requirement</option>
              <option value="decision">Decision</option>
              <option value="acceptance_criterion">Acceptance criterion</option>
            </select>
            <select aria-label="Decision status" value={decisionStatus} onChange={(event) => setDecisionStatus(event.target.value as DecisionStatus)} className="border border-border bg-background px-2 py-1 text-xs">
              <option value="proposed">Proposed</option>
              <option value="confirmed">Confirmed by me</option>
              <option value="observed">Observed</option>
              <option value="unresolved">Unresolved</option>
            </select>
            <select
              aria-label="Evidence sources"
              multiple
              value={selectedSourceIds}
              onChange={(event) => setSelectedSourceIds(Array.from(event.target.selectedOptions, (option) => option.value))}
              className="min-w-48 border border-border bg-background px-2 py-1 text-xs"
              size={Math.min(4, Math.max(2, workspace?.sources.length ?? 2))}
            >
              {(workspace?.sources ?? []).map((source) => (
                <option key={source._id} value={source._id}>{source.revisionLabel} · {source.locator} r{source.revision}</option>
              ))}
            </select>
            <Button size="sm" disabled={busy || !text.trim()}><Plus className="mr-1 h-3 w-3" /> Add</Button>
          </div>
          <p className="text-xs text-muted-foreground">Suggested links remain unconfirmed until a reviewer checks that the source supports the claim.</p>
        </form>

        <form className="flex flex-wrap gap-2 border-t border-border pt-3" onSubmit={handleAddNote}>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={20000} className="min-w-48 flex-1 border border-border bg-background px-2 py-2 text-sm" placeholder="Capture a short evidence note" aria-label="Evidence note" />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !note.trim()}>Save note</Button>
        </form>

        {workspace?.sources.length ? (
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-xs font-semibold">Captured evidence revisions ({workspace.sources.length})</summary>
            <ul className="mt-2 space-y-2">
              {workspace.sources.map((source) => (
                <li key={source._id} className="border border-border/60 p-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{source.revisionLabel} · revision {source.revision}</span>
                    <span className="text-muted-foreground">{new Date(source.capturedAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{source.kind} · {source.origin ?? 'unknown origin'} · {source.locator} · SHA-256 {source.contentHash.slice(0, 12)}</div>
                  <p className="mt-1 whitespace-pre-wrap">{source.excerpt}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function repositorySourceUrl(sourceKey: string, commitSha: string): string {
  const locator = sourceKey.replace(/^repository_file:/, '');
  const separator = locator.indexOf(':');
  if (separator < 1) return 'https://github.com';
  const repo = locator.slice(0, separator);
  const path = locator.slice(separator + 1).split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${repo}/blob/${encodeURIComponent(commitSha)}/${path}`;
}
