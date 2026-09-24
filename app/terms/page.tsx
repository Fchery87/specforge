"use client";

import { motion } from "motion/react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-12">
            Terms of <span className="text-primary">Service</span>
          </h1>

          <div className="space-y-12 text-zinc-400 font-medium leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                1. The Platform
              </h2>
              <p>
                SpecForge is a specification engineering platform. By accessing or using the service, you agree to these Terms. If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                2. Ownership of Output
              </h2>
              <p>
                You retain complete ownership of all artifacts, specifications, user stories, diagrams, and code contracts generated through SpecForge. You are free to modify, distribute, and implement your artifacts without restriction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                3. Automated Generation Advisory
              </h2>
              <p>
                SpecForge uses large language models to assist in synthesizing specifications and extracting schemas. While the system enforces evidence grounding and syntax validation, generated specifications should be reviewed and verified by your engineering team before production deployment.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                4. Credentials and Storage
              </h2>
              <p>
                You are responsible for the confidentiality of API credentials entered into the platform. SpecForge stores provider API keys using AES-256-GCM encryption at rest and loads them temporarily in memory only when executing authorized requests.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                5. Acceptable Use
              </h2>
              <p>
                You agree not to use the service to generate malicious code, breach system boundaries, or violate applicable intellectual property laws. Violations will result in immediate suspension of access.
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
