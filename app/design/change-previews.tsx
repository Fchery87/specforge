"use client";

import { ChangeList } from "@/components/changes/change-list";
import { ChangeOps, type ChangeOpView } from "@/components/changes/change-ops";
import { NewChangeForm } from "@/components/changes/new-change-form";
import { StaleDocumentNotice } from "@/components/stale-document-notice";

const target = (claimId: string, text: string) => ({ claimId, text, phaseId: "prd", live: true });

const PREVIEW_OPS: ChangeOpView[] = [
  {
    _id: "o1", order: 0, reason: "Owners asked to invite without typing addresses.", evidenceSourceIds: [],
    op: { type: "add", phaseId: "prd", kind: "requirement", text: "An owner may share an invite link that expires after seven days." },
    target: null,
  },
  {
    _id: "o2", order: 1, reason: "Email is no longer the only way in.", evidenceSourceIds: ["s1"],
    op: { type: "modify", claim: "c12", baseText: "An owner invites members by email.", text: "An owner invites members by email or by an invite link." },
    target: target("REQ-0012", "An owner invites members by email."),
  },
  {
    _id: "o3", order: 2, reason: "Links carry their own expiry.", evidenceSourceIds: [],
    op: { type: "remove", claim: "c20", baseText: "Pending invitations expire after one day." },
    target: target("REQ-0020", "Pending invitations expire after one day."),
  },
  {
    _id: "o4", order: 3, reason: "The requirement is right; the link route is missing.", evidenceSourceIds: [],
    op: { type: "reaffirm", claim: "c21", baseText: "Opening an invitation shows the invite page." },
    target: target("REQ-0021", "Opening an invitation shows the invite page."),
  },
];

const noop = async () => {};

/** Fixtures for the change surfaces, which read Convex in the product. */
export function ChangePreviews() {
  return (
    <div className="grid gap-10">
      <div className="rounded-lg border border-line bg-surface px-5 py-6 md:px-8">
        <h3 className="font-display text-title font-semibold text-ink">Changes</h3>
        <div className="mt-5">
          <ChangeList
            projectId="preview-atlas"
            changes={[
              { _id: "ch3", changeNumber: 3, kind: "bugfix", title: "Invite links show a 404", status: "draft" },
              { _id: "ch2", changeNumber: 2, kind: "feature", title: "Invite members with a link", status: "applied" },
              { _id: "ch1", changeNumber: 1, kind: "feature", title: "Archive a project", status: "abandoned" },
            ]}
          />
        </div>
      </div>

      <div data-preview="change-ops">
        <ChangeOps
          ops={PREVIEW_OPS}
          editable
          phasesWithDocuments={["prd", "stories"]}
          conflicts={[{ order: 1, claimId: "REQ-0012", reason: "The requirement was reworded after this change was drafted" }]}
          onSave={noop}
        />
      </div>

      <div data-preview="new-change" className="max-w-xl rounded-lg border border-line bg-panel p-6">
        <NewChangeForm onSubmit={noop} onCancel={() => {}} />
      </div>

      <StaleDocumentNotice reason="CHG-0002 applied" onRegenerate={() => {}} />
    </div>
  );
}
