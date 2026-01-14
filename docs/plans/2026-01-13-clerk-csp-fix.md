# Clerk CSP Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Clerk JS load failures by allowing Clerk domains (and related assets) in the CSP and add a regression test.

**Architecture:** The CSP is built in `next.config.js` and applied to all routes via `headers()`. We will update the CSP directives to allow Clerk-hosted scripts, frames, and assets, plus Google Fonts already used in the layout. A focused test will assert the CSP contains the required allowlist entries.

**Tech Stack:** Next.js 16, Clerk, Vitest

### Task 1: Add failing CSP regression test

**Files:**
- Modify: `lib/__tests__/security-headers.test.ts`
- Test: `lib/__tests__/security-headers.test.ts`

**Step 1: Write the failing test**

```ts
it("allows Clerk and Google Fonts in CSP", () => {
  const content = fs.readFileSync("next.config.js", "utf8");
  expect(content).toContain("clerk.accounts.dev");
  expect(content).toContain("clerk.com");
  expect(content).toContain("fonts.googleapis.com");
  expect(content).toContain("fonts.gstatic.com");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/__tests__/security-headers.test.ts`
Expected: FAIL because the CSP does not include Clerk or Google Fonts domains yet.

### Task 2: Update CSP allowlist for Clerk + fonts

**Files:**
- Modify: `next.config.js`

**Step 1: Write minimal implementation**

```js
"script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev; " +
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
"font-src 'self' data: https://fonts.gstatic.com; " +
"frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev; " +
"img-src 'self' data: https:; " +
```

**Step 2: Run test to verify it passes**

Run: `bun test lib/__tests__/security-headers.test.ts`
Expected: PASS

### Task 3: Optional manual verification

**Files:**
- None

**Step 1: Start dev server**

Run: `bun run dev`
Expected: Clerk script loads without CSP errors; sign-in pages render.

