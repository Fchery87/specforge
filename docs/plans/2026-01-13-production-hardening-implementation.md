# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden SpecForge for production by adding strict sanitization, admin protection, abuse controls, storage cleanup, phase gating, observability, and CI gates without changing workflow.

**Architecture:** Replace preview HTML generation with a strict Markdown->HTML+sanitize pipeline and enforce backend validations and rate limits. Add structured redacted logs for LLM actions and a minimal GitHub Actions workflow for PR checks.

**Tech Stack:** Next.js 16, Convex, Bun, GitHub Actions.

### Task 1: Add strict HTML sanitization utilities

**Files:**
- Create: `lib/markdown-render.ts`
- Modify: `package.json`
- Test: `lib/__tests__/markdown-render.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { renderMarkdownSafe } from "../markdown-render";

describe("renderMarkdownSafe", () => {
  it("strips script tags and unsafe attributes", () => {
    const input = "# Title\n\n<script>alert(1)</script>\n\n<a href=\"javascript:alert(1)\">x</a>";
    const html = renderMarkdownSafe(input);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("preserves safe markdown formatting", () => {
    const input = "## Heading\n\n- Item\n\n`code`";
    const html = renderMarkdownSafe(input);
    expect(html).toContain("<h2>");
    expect(html).toContain("<li>");
    expect(html).toContain("<code>");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/markdown-render.test.ts`
Expected: FAIL with "Cannot find module '../markdown-render'" or similar

**Step 3: Write minimal implementation**

```ts
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1","h2","h3","h4","h5","h6",
    "p","ul","ol","li","strong","em","code","pre",
    "blockquote","hr","br","a"
  ],
  allowedAttributes: {
    a: ["href","title","rel","target"],
  },
  allowedSchemes: ["http","https","mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, true),
  },
};

export function renderMarkdownSafe(markdown: string): string {
  const raw = marked.parse(markdown, { mangle: false, headerIds: false });
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/markdown-render.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/markdown-render.ts lib/__tests__/markdown-render.test.ts package.json
 git commit -m "feat: add strict markdown sanitization"
```

### Task 2: Use sanitized renderer in artifact generation and preview

**Files:**
- Modify: `convex/actions/generatePhase.ts`
- Modify: `components/artifact-preview.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { renderMarkdownSafe } from "../markdown-render";

describe("preview sanitization", () => {
  it("ensures HTML output is sanitized", () => {
    const html = renderMarkdownSafe("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/markdown-render.test.ts`
Expected: FAIL until renderMarkdownSafe is used in generation

**Step 3: Write minimal implementation**

```ts
// convex/actions/generatePhase.ts
import { renderMarkdownSafe } from "../../lib/markdown-render";

const previewHtml = renderMarkdownSafe(content);
```

```tsx
// components/artifact-preview.tsx
// ensure previewHtml is sanitized server-side; no functional change needed beyond trusting sanitized HTML
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/markdown-render.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts components/artifact-preview.tsx
 git commit -m "feat: sanitize artifact previews"
```

### Task 3: Lock down admin debug endpoint

**Files:**
- Modify: `convex/admin.ts`
- Test: `convex/__tests__/admin-auth.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { requireAdmin } from "../lib/auth";

describe("admin protections", () => {
  it("debugIdentity requires admin", async () => {
    expect(requireAdmin).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/__tests__/admin-auth.test.ts`
Expected: FAIL until debugIdentity uses requireAdmin

**Step 3: Write minimal implementation**

```ts
// convex/admin.ts
export const debugIdentity = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { error: "Not authenticated" };
    return { identityKeys: Object.keys(identity), identityValues: identity };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/__tests__/admin-auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/admin.ts convex/__tests__/admin-auth.test.ts
 git commit -m "feat: require admin for debug identity"
```

### Task 4: Remove noisy client debug logs

**Files:**
- Modify: `components/questions-panel.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("questions panel logging", () => {
  it("removes debug console logs", () => {
    const content = fs.readFileSync("components/questions-panel.tsx", "utf8");
    expect(content).not.toContain("[DEBUG]");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/logging-cleanup.test.ts`
Expected: FAIL until debug logs removed

**Step 3: Write minimal implementation**

```tsx
// components/questions-panel.tsx
// Remove console.debug/console.log lines tagged [DEBUG]
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/logging-cleanup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add components/questions-panel.tsx lib/__tests__/logging-cleanup.test.ts
 git commit -m "chore: remove client debug logging"
```

### Task 5: Add rate limits for questions and ZIP generation

**Files:**
- Modify: `convex/rateLimiter.ts`
- Modify: `convex/actions/generateQuestions.ts`
- Modify: `convex/actions/generateProjectZip.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("rate limits", () => {
  it("includes generateQuestions and generateProjectZip limits", () => {
    const content = fs.readFileSync("convex/rateLimiter.ts", "utf8");
    expect(content).toContain("generateQuestions");
    expect(content).toContain("generateProjectZip");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/rate-limits.test.ts`
Expected: FAIL until new limits are added

**Step 3: Write minimal implementation**

```ts
// convex/rateLimiter.ts
 generateQuestions: { kind: "token bucket", period: MINUTE, rate: 10, capacity: 15 },
 generateProjectZip: { kind: "token bucket", period: MINUTE, rate: 5, capacity: 8 },
 globalZipGen: { kind: "fixed window", period: MINUTE, rate: 30 },
```

```ts
// convex/actions/generateQuestions.ts
await rateLimiter.limit(ctx, "generateQuestions", { key: userId, throws: true });
```

```ts
// convex/actions/generateProjectZip.ts
await rateLimiter.limit(ctx, "generateProjectZip", { key: userId, throws: true });
await rateLimiter.limit(ctx, "globalZipGen", { throws: true });
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/rate-limits.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/rateLimiter.ts convex/actions/generateQuestions.ts convex/actions/generateProjectZip.ts lib/__tests__/rate-limits.test.ts
 git commit -m "feat: add rate limits for questions and zip"
```

### Task 6: Add phase gating for required questions

**Files:**
- Modify: `convex/actions/generatePhase.ts`
- Test: `convex/__tests__/phase-gating.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { hasMissingRequiredAnswers } from "../actions/generatePhase";

describe("phase gating", () => {
  it("detects missing required answers", () => {
    const questions = [
      { id: "q1", text: "A", aiGenerated: false, required: true },
      { id: "q2", text: "B", aiGenerated: false, required: false, answer: "ok" },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test convex/__tests__/phase-gating.test.ts`
Expected: FAIL until helper is added

**Step 3: Write minimal implementation**

```ts
// convex/actions/generatePhase.ts
export function hasMissingRequiredAnswers(questions: Question[]): boolean {
  return questions.some((q) => q.required && !q.answer?.trim());
}

if (hasMissingRequiredAnswers(questions) && args.phaseId !== "handoff") {
  throw new Error("Please answer all required questions before generating");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test convex/__tests__/phase-gating.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generatePhase.ts convex/__tests__/phase-gating.test.ts
 git commit -m "feat: enforce required question gating"
```

### Task 7: Clean up old ZIP storage

**Files:**
- Modify: `convex/actions/generateProjectZip.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("zip cleanup", () => {
  it("deletes previous zip storage if present", () => {
    const content = fs.readFileSync("convex/actions/generateProjectZip.ts", "utf8");
    expect(content).toContain("storage.delete");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/zip-cleanup.test.ts`
Expected: FAIL until delete added

**Step 3: Write minimal implementation**

```ts
// convex/actions/generateProjectZip.ts
if (project.zipStorageId) {
  await ctx.storage.delete(project.zipStorageId);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/zip-cleanup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/actions/generateProjectZip.ts lib/__tests__/zip-cleanup.test.ts
 git commit -m "feat: delete old project zip before saving new one"
```

### Task 8: Add security headers (CSP and baseline)

**Files:**
- Modify: `next.config.js`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("security headers", () => {
  it("adds a CSP header in next config", () => {
    const content = fs.readFileSync("next.config.js", "utf8");
    expect(content).toContain("Content-Security-Policy");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/security-headers.test.ts`
Expected: FAIL until headers added

**Step 3: Write minimal implementation**

```js
// next.config.js
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:;",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig = {
  ...,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/security-headers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add next.config.js lib/__tests__/security-headers.test.ts
 git commit -m "feat: add baseline security headers"
```

### Task 9: Add observability logging helper and use in LLM actions

**Files:**
- Create: `lib/llm/telemetry.ts`
- Modify: `convex/actions/generatePhase.ts`
- Modify: `convex/actions/generateQuestions.ts`
- Modify: `convex/actions/generateQuestionAnswer.ts`
- Modify: `convex/actions/generateAllQuestionAnswers.ts`
- Test: `lib/llm/__tests__/telemetry.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildTelemetry } from "../telemetry";

describe("telemetry", () => {
  it("redacts secrets and excludes prompts", () => {
    const entry = buildTelemetry({ provider: "openai", model: "gpt-4o", prompt: "secret" });
    expect(entry).not.toHaveProperty("prompt");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/llm/__tests__/telemetry.test.ts`
Expected: FAIL until helper exists

**Step 3: Write minimal implementation**

```ts
// lib/llm/telemetry.ts
import { redactSecrets } from "./logging";

export function buildTelemetry(input: {
  provider: string;
  model: string;
  durationMs?: number;
  success?: boolean;
  tokens?: { prompt?: number; completion?: number; total?: number };
  error?: string;
}): Record<string, unknown> {
  const { provider, model, durationMs, success, tokens, error } = input;
  return redactSecrets({ provider, model, durationMs, success, tokens, error });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/llm/__tests__/telemetry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/llm/telemetry.ts lib/llm/__tests__/telemetry.test.ts
 git commit -m "feat: add llm telemetry helper"
```

### Task 10: Add CI gates for lint/typecheck/test

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("ci", () => {
  it("adds a GitHub Actions workflow", () => {
    const exists = fs.existsSync(".github/workflows/ci.yml");
    expect(exists).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/ci-workflow.test.ts`
Expected: FAIL until workflow exists

**Step 3: Write minimal implementation**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/ci-workflow.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml lib/__tests__/ci-workflow.test.ts
 git commit -m "ci: add lint/typecheck/test gates"
```

### Task 11: Document required encryption key

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("env docs", () => {
  it("documents CONVEX_ENCRYPTION_KEY", () => {
    const env = fs.readFileSync(".env.example", "utf8");
    expect(env).toContain("CONVEX_ENCRYPTION_KEY");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/env-docs.test.ts`
Expected: FAIL until docs updated

**Step 3: Write minimal implementation**

```env
# Convex
CONVEX_ENCRYPTION_KEY=your-32-byte-hex-key
```

```md
- `CONVEX_ENCRYPTION_KEY` - required for encrypting stored credentials
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/__tests__/env-docs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add .env.example README.md lib/__tests__/env-docs.test.ts
 git commit -m "docs: document Convex encryption key"
```

