# Production Hardening Design

**Goal:** Make SpecForge production-ready without changing the core workflow by adding strict sanitization, admin protection, abuse controls, storage cleanup, phase gating, observability, and CI gates.

**Architecture:** Replace ad-hoc HTML preview generation with a strict Markdown -> HTML pipeline plus sanitization. Add rate limits and server-side gating to protect expensive actions. Add simple structured, redacted logging for LLM actions and a minimal GitHub Actions pipeline for lint/typecheck/test.

**Tech Stack:** Next.js 16, Convex, Clerk, Bun, GitHub Actions.

## Security and Rendering

- Use a real Markdown renderer and a strict sanitizer to prevent stored XSS from LLM output.
- Keep the UI preview HTML sanitized end-to-end and remove unsafe direct rendering of raw strings.
- Add CSP and other security headers in Next.js to reduce blast radius.
- Lock down admin-only debug endpoints or remove them for production.
- Remove debug logs from client components to avoid leaking user content.
- Document `CONVEX_ENCRYPTION_KEY` in `.env.example` and README.

## Abuse Controls, Storage Cleanup, and Phase Gating

- Add per-user and global rate limits for `generateQuestions` and `generateProjectZip`.
- Enforce required question answers server-side before phase generation.
- Ensure phase status transitions always land in `ready` or `error` after LLM actions.
- Delete previous ZIP storage blobs before saving a new ZIP for a project.

## Observability and CI Gates

- Add structured, redacted server logging for LLM actions: provider, model, timing, token counts, success/failure.
- Do not log prompts or user data.
- Add GitHub Actions workflow running `bun run lint`, `bun run typecheck`, and `bun test` on PRs.

## Scope and Workflow Impact

- All changes are transparent to end users except stricter validation of required questions (which are already flagged as required).
- No UI flow changes, no new configuration steps for users.

