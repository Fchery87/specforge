import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service | SpecForge",
  description:
    "The terms that govern your use of SpecForge, including ownership of generated artifacts, credential storage, and acceptable use.",
};

const sections = [
  {
    title: "The platform",
    body: "SpecForge is a specification engineering platform. By accessing or using the service, you agree to these Terms. If you do not agree, do not use the service.",
  },
  {
    title: "Ownership of output",
    body: "You retain complete ownership of all artifacts, specifications, user stories, diagrams, and code contracts generated through SpecForge. You are free to modify, distribute, and implement your artifacts without restriction.",
  },
  {
    title: "Automated generation advisory",
    body: "SpecForge uses large language models to assist in synthesizing specifications and extracting schemas. While the system enforces evidence grounding and syntax validation, generated specifications should be reviewed and verified by your engineering team before production deployment.",
  },
  {
    title: "Credentials and storage",
    body: "You are responsible for the confidentiality of API credentials entered into the platform. SpecForge stores provider API keys using AES-256-GCM encryption at rest and loads them temporarily in memory only when executing authorized requests.",
  },
  {
    title: "Acceptable use",
    body: "You agree not to use the service to generate malicious code, breach system boundaries, or violate applicable intellectual property laws. Violations will result in immediate suspension of access.",
  },
];

export default function TermsPage() {
  return (
    <div className="page-container page-section">
      <div className="max-w-2xl">
        <p className="text-caption text-dim">Legal</p>
        <h1 className="mt-2 text-heading font-medium text-ink">Terms of service</h1>

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
