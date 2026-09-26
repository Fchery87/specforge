import { describe, it, expect } from "vitest";
import {
  claimState,
  parseClaimManifest,
  summarizeClaims,
  type ParsedClaim,
} from "../claims";
import { formatClaimManifest } from "../evidence";

const manifest = [
  "## Requirement Traceability",
  "",
  "Review status and evidence links are advisory project records.",
  "",
  "- **C-014** [confirmed; reviewed]: A member with the editor role may archive a project. — Evidence: lib/authz.ts (4f2a91c, supports); Who may archive (2026-09-22, supports)",
  "- **C-015** [proposed; reviewed]: Restoring an archived project requires an owner. — Evidence: lib/projects.ts (9b1e0d4, partial)",
  "- **C-016** [unresolved; pending]: Audit events are retained for one year. — Evidence not captured",
  "- A bullet that is not a claim, and must be ignored.",
].join("\n");

describe("parseClaimManifest", () => {
  it("reads claim bullets and ignores everything else", () => {
    const claims = parseClaimManifest(manifest);
    expect(claims.map((claim) => claim.claimId)).toEqual(["C-014", "C-015", "C-016"]);
  });

  it("splits the decision and review status", () => {
    const [first, second, third] = parseClaimManifest(manifest);
    expect(first.decisionStatus).toBe("confirmed");
    expect(first.reviewStatus).toBe("reviewed");
    expect(second.decisionStatus).toBe("proposed");
    expect(third.reviewStatus).toBe("pending");
  });

  it("keeps the claim text without the evidence clause", () => {
    const [first] = parseClaimManifest(manifest);
    expect(first.text).toBe(
      "A member with the editor role may archive a project."
    );
  });

  it("parses each evidence entry into locator, revision and support", () => {
    const [first] = parseClaimManifest(manifest);
    expect(first.evidence).toHaveLength(2);
    expect(first.evidence[0]).toEqual({
      locator: "lib/authz.ts",
      revision: "4f2a91c",
      support: "supports",
    });
    expect(first.evidence[1].locator).toBe("Who may archive");
  });

  it("marks a claim with no captured evidence as having none", () => {
    const third = parseClaimManifest(manifest)[2];
    expect(third.hasEvidence).toBe(false);
    expect(third.evidence).toEqual([]);
    expect(third.text).toBe("Audit events are retained for one year.");
  });

  it("returns nothing for markdown without claims", () => {
    expect(parseClaimManifest("## Section\n\nJust prose.")).toEqual([]);
  });

  it("survives a claim line with no evidence clause at all", () => {
    const claims = parseClaimManifest("- **C-001** [confirmed; reviewed]: Short claim.");
    expect(claims).toHaveLength(1);
    expect(claims[0].hasEvidence).toBe(false);
    expect(claims[0].text).toBe("Short claim.");
  });
});

describe("claimState", () => {
  it("reads a confirmed decision with evidence as confirmed", () => {
    expect(claimState(parseClaimManifest(manifest)[0])).toBe("confirmed");
  });

  it("reads an unsettled decision with evidence as proposed", () => {
    expect(claimState(parseClaimManifest(manifest)[1])).toBe("proposed");
  });

  it("reads anything without evidence as untraced", () => {
    expect(claimState(parseClaimManifest(manifest)[2])).toBe("untraced");
  });
});

/**
 * The vocabulary the product actually writes.
 *
 * `convex/schema.ts` allows `current` and `needs_review`, and `convex/evidence.ts` writes
 * `needs_review` for a claim whose evidence changed. The first version of `claimState` tested for
 * `"pending"`, which the app never writes, so the check was always true and a claim explicitly
 * flagged for review read as settled. Every fixture above used the markdown vocabulary
 * (`reviewed` / `pending`), which is why the tests passed while the logic was wrong against real
 * data. These cases come from the app's side so that cannot happen again.
 */
describe("claimState against the review status the app writes", () => {
  // One line, because that is what `formatClaimManifest` writes: the parser reads per line and a
  // continuation line is not part of the bullet.
  const withReview = (reviewStatus: string) =>
    parseClaimManifest(
      `- **C-014** [confirmed; ${reviewStatus}]: A claim. — Evidence: lib/authz.ts (4f2a91c, supports)`
    )[0];

  it("reports a claim flagged needs_review as proposed, not settled", () => {
    expect(claimState(withReview("needs_review"))).toBe("proposed");
  });

  it("reports a claim whose review is current as confirmed", () => {
    expect(claimState(withReview("current"))).toBe("confirmed");
  });

  it("round-trips the manifest the exporter writes", () => {
    const exported = formatClaimManifest([
      {
        claimId: "C-014",
        decisionStatus: "confirmed",
        reviewStatus: "needs_review",
        text: "Flagged for review.",
        links: [
          {
            source: { locator: "lib/authz.ts", revisionLabel: "4f2a91c" },
            supportStatus: "supports",
          },
        ],
      },
    ]);

    expect(claimState(parseClaimManifest(exported)[0])).toBe("proposed");
  });
});

describe("summarizeClaims", () => {
  it("reports the worst state in the section", () => {
    const summary = summarizeClaims(parseClaimManifest(manifest));
    expect(summary).toEqual({
      total: 3,
      confirmed: 1,
      proposed: 1,
      untraced: 1,
      state: "untraced",
    });
  });

  it("reports proposed when nothing is untraced", () => {
    const claims: ParsedClaim[] = [
      {
        claimId: "C-1",
        decisionStatus: "confirmed",
        reviewStatus: "reviewed",
        text: "a",
        evidence: [{ locator: "f", revision: "1", support: "supports" }],
        hasEvidence: true,
      },
      {
        claimId: "C-2",
        decisionStatus: "proposed",
        reviewStatus: "reviewed",
        text: "b",
        evidence: [{ locator: "g", revision: "2", support: "partial" }],
        hasEvidence: true,
      },
    ];
    expect(summarizeClaims(claims).state).toBe("proposed");
  });

  it("treats a section with no claims as untraced", () => {
    expect(summarizeClaims([]).state).toBe("untraced");
    expect(summarizeClaims([]).total).toBe(0);
  });
});
