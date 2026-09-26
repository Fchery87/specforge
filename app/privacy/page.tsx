import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy | SpecForge",
  description:
    "How SpecForge collects, encrypts, processes, and retains your account data, project evidence, and provider credentials.",
};

const sections = [
  {
    title: "Data collection",
    body: "We collect information needed to run your specification pipeline. This includes account details managed by Clerk (name and email), project briefs, interview responses, notes, and repository metadata when you connect GitHub.",
  },
  {
    title: "Encrypted credentials",
    body: "If you provide your own LLM provider API keys, they are encrypted at rest with AES-256-GCM. We never store keys in plaintext. Keys are decrypted temporarily in memory only when executing authorized requests.",
  },
  {
    title: "Third-party LLM processing",
    body: "To generate artifacts, your input prompts and attached evidence excerpts are sent to configured LLM providers (such as Anthropic, OpenAI, Google, DeepSeek, or Mistral). These providers process requests under their respective terms. SpecForge does not share your user identity with model providers.",
  },
  {
    title: "Data retention and tenancy",
    body: "Artifacts, claims, and project evidence are stored in your Convex database while your account is active. Project queries and mutations strictly verify user ownership at every boundary. Deleting a project permanently cascades to all linked artifacts and claim records.",
  },
  {
    title: "Security protocols",
    body: "We isolate project data per user and authenticate every operation. You can inspect all captured revisions and export complete archive bundles at any time.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="page-container page-section">
      <div className="max-w-2xl">
        <p className="text-caption text-dim">Legal</p>
        <h1 className="mt-2 text-heading font-medium text-ink">Privacy policy</h1>

        <div className="document-prose mt-10 text-ink">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}

          <p className="text-caption text-dim">Last updated: September 2026</p>
        </div>
      </div>
    </div>
  );
}
