"use client";

import { motion } from "framer-motion";

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
                We collect information necessary to forge your project specifications. This includes account data from Clerk (email, name) and the Input Content you provide (project goals, requirements).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                2. Encrypted Credentials
              </h2>
              <p>
                If you opt to use your own LLM provider keys, they are encrypted at rest using system-level AES encryption. We do not store keys in plaintext. They are decrypted temporarily in memory only when a generation request is executed.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                3. Third-Party Processing
              </h2>
              <p>
                To generate Artifacts, your Input Content is transmitted to third-party LLM providers (e.g., DeepSeek, OpenAI, Anthropic). These partners process data according to their respective privacy protocols. SpecForge does not share your account identity with these providers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                4. Data Retention
              </h2>
              <p>
                Artifacts and project data are stored in your Convex instance for as long as your account remains active. You can purge any project or artifact at your discretion, which results in permanent removal from our active database.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground mb-4 border-l-4 border-primary pl-4">
                5. Security Protocols
              </h2>
              <p>
                We employ modern security standards to isolate user environments and protect data integrity. However, no digital forge is absolute. Users are encouraged to maintain independent backups of all critical specifications.
              </p>
            </section>

            <section className="pt-8 border-t border-border">
              <p className="text-xs uppercase tracking-widest">
                Last Updated: January 14, 2026 // Secure Protocol Active
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
