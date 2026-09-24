"use client";

import { motion } from "motion/react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-12">
            Privacy <span className="text-primary">Policy</span>
          </h1>

          <div className="space-y-12 text-zinc-400 font-medium leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                1. Data Collection
              </h2>
              <p>
                We collect information needed to run your specification pipeline. This includes account details managed by Clerk (name and email), project briefs, interview responses, notes, and repository metadata when you connect GitHub.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                2. Encrypted Credentials
              </h2>
              <p>
                If you provide your own LLM provider API keys, they are encrypted at rest with AES-256-GCM. We never store keys in plaintext. Keys are decrypted temporarily in memory only when executing authorized requests.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                3. Third-Party LLM Processing
              </h2>
              <p>
                To generate artifacts, your input prompts and attached evidence excerpts are sent to configured LLM providers (such as Anthropic, OpenAI, Google, DeepSeek, or Mistral). These providers process requests under their respective terms. SpecForge does not share your user identity with model providers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                4. Data Retention and Tenancy
              </h2>
              <p>
                Artifacts, claims, and project evidence are stored in your Convex database while your account is active. Project queries and mutations strictly verify user ownership at every boundary. Deleting a project permanently cascades to all linked artifacts and claim records.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                5. Security Protocols
              </h2>
              <p>
                We isolate project data per user and authenticate every operation. You can inspect all captured revisions and export complete archive bundles at any time.
              </p>
            </section>

            <section className="pt-8 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Last updated: September 2026
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
