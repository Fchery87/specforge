# SpecForge Codebase Analysis Report

> Deep dive analysis of the SpecForge project identifying gaps, issues, and improvement opportunities.

**Analysis Date:** January 11, 2026

---

## Executive Summary

After a comprehensive review of the SpecForge codebase, I've identified **23 items** across 5 categories. The project has a solid foundation but has several incomplete implementations, missing features from the architecture plan, and wiring issues that need attention.

---

## 🔴 Critical Issues (Requires Immediate Attention)

### 1. LLM Generation Returns Placeholder Text

**Location:** `convex/actions/generatePhase.ts` (lines ~446-451)

The `generateSectionContent` function does not actually call the LLM API. It returns placeholder text:

```typescript
// Line ~451: This returns placeholder instead of actual LLM response
return `AI-generated content for ${sectionName}...`;
```

**Impact:** Phase generation doesn't produce real artifacts - just placeholder text.

**Fix Required:** Call `llmClient.complete()` with the constructed prompt.

---

### 2. Question Answer Actions Return Hardcoded Responses

**Location:**

- `convex/actions/generateQuestionAnswer.ts` (L199-L202)
- `convex/actions/generateAllQuestionAnswers.ts` (L404-L412)

Both AI answer generation functions have TODO comments and return placeholder strings instead of calling the LLM.

---

### 3. Missing Admin Role Authorization

**Location:** `convex/admin.ts`

All admin functions have commented-out role checks:

```typescript
// In production, check for admin role here
// const publicMetadata = identity.publicMetadata as { role?: string };
// if (publicMetadata.role !== "admin") throw new Error("Unauthorized");
```

**Impact:** Any authenticated user can manage LLM models and system credentials.

---

## 🟠 Wiring & Integration Issues

### 4. Unused Mistral Provider in Registry

**Location:** `lib/llm/registry.ts` (L30-L33)

Mistral models are defined in `MODEL_REGISTRY` but:

- No `lib/llm/providers/mistral.ts` provider exists
- No Mistral client in `getLlmClient()` switch statement in `convex/actions/generatePhase.ts`

---

### 5. Google Provider in Types Not Implemented

**Location:** `lib/llm/types.ts` (L41)

`LlmModel.provider` includes `"google"` but there's no Google Gemini provider implementation.

---

### 6. UserConfig `systemKeyId` Mismatch

**Location:** `lib/llm/types.ts` (L55-L64) vs `convex/schema.ts` (L60-L68)

The `UserConfig` interface includes `systemKeyId` but the Convex schema for `userLlmConfigs` doesn't have this field.

---

### 7. generateProjectZip Missing Implementation Details

**Location:** `convex/actions/generateProjectZip.ts`

The file exists but at only 1.4KB likely has incomplete implementation compared to the comprehensive `lib/zip.ts` utilities.

---

### 8. Phase PRD Missing from DEFAULT_PHASES

**Location:** `convex/projects.ts` (L5)

```typescript
const DEFAULT_PHASES = ['brief', 'specs', 'stories', 'artifacts', 'handoff'];
```

The `docs/ARCHITECTURE.md` shows `PRD` as the second phase:

```
Brief → PRD → Specs/Architecture → Stories → Artifacts → Handoff
```

---

## 🟡 Missing Features (Per Documentation)

### 9. No Test Suite

**Impact:** No automated tests exist for any functionality.

**Recommendation:** Add Vitest or Jest with tests for:

- Encryption/decryption
- LLM client mocking
- Convex function unit tests

---

### 10. Artifact previewHtml Never Populated

**Location:** `convex/actions/generatePhase.ts` (L566-L579)

`generatePreviewHtml()` exists but returns basic HTML. The artifact viewer likely expects rendered Markdown.

---

### 11. Self-Critique Loop Not Fully Wired

**Location:** `convex/actions/generatePhase.ts` (L464-L488)

The `selfCritiqueSection` function exists but may not call the actual LLM - needs verification that it uses the LLM client properly.

---

### 12. ZIP Download Flow Incomplete

Per `docs/ARCHITECTURE.md`, ZIP should be stored in Convex file storage with a signed URL in `artifacts.zipFileUrl`. The full flow needs verification.

---

## 🔵 Code Quality Improvements

### 13. Excessive Console Logging in Production Code

**Location:** `convex/internalActions.ts`

Contains 20+ console.log statements for debugging. These should be:

- Removed for production, OR
- Wrapped in a debug utility

---

### 14. Duplicate getLlmClient Function

The same `getLlmClient` helper is duplicated across:

- `convex/actions/generatePhase.ts`
- `convex/actions/generateQuestionAnswer.ts`
- `convex/actions/generateAllQuestionAnswers.ts`

Should be extracted to a shared utility.

---

### 15. Inconsistent Type Annotations

Many functions use `any` type:

- `model: any` across action handlers
- `systemCredentialsMap: any`
- `configs: any[]`

---

### 16. Unused ENCRYPTION_KEY in userConfigs.ts

**Location:** `convex/userConfigs.ts` (L5-L6)

```typescript
const ENCRYPTION_KEY =
  process.env.CONVEX_ENCRYPTION_KEY ?? 'default-dev-key-change-in-production';
```

This constant is defined but never used in the file.

---

## 🟢 Security Considerations

### 17. Default Encryption Key in Code

**Location:** Multiple files

```typescript
'default-dev-key-change-in-production';
```

This fallback should throw an error in production instead of using a weak default.

---

### 18. API Key Logging Risk

**Location:** `convex/internalActions.ts` (L136-L140)

Decrypted API key preview is logged:

```typescript
console.log(
  '[...] Decrypted key preview (first 10 chars):',
  decryptedApiKey ? decryptedApiKey.substring(0, 10) + '...' : 'null'
);
```

---

### 19. No Rate Limiting on LLM Actions

Actions like `generatePhase`, `generateQuestionAnswer` have no throttling which could lead to:

- API cost overruns
- Denial of service

---

## 📋 Schema & Data Model Issues

### 20. artifacts Table Missing storyId Index

**Location:** `convex/schema.ts` (L27-L37)

The artifacts table only has `by_project` index but no efficient way to query artifacts by storyId if needed.

---

### 21. phases Table Stores Questions Inline

**Location:** `convex/schema.ts` (L18-L26)

Questions are stored as an array within the phases table. For large question sets, this could hit document size limits.

---

## 🔧 Frontend Issues

### 22. AI Answer Plan Not Fully Implemented

**Location:** `docs/plans/2026-01-10-ai-question-answers.md`

The implementation plan shows detailed code but:

- Actions return placeholder text (see Issue #2)
- The batch modal may not function correctly with real LLM calls

---

### 23. Potential Double Scroll Issue

Previous conversation mentions "fixing double scrollbar bug" - verify this is resolved in `app/globals.css`.

---

## Recommended Priority Order

| Priority | Issue                              | Effort |
| -------- | ---------------------------------- | ------ |
| 1        | #1 - LLM Generation Placeholders   | Medium |
| 2        | #2 - Question Answer Placeholders  | Medium |
| 3        | #3 - Admin Role Authorization      | Low    |
| 4        | #8 - Add PRD Phase                 | Low    |
| 5        | #4,#5 - Complete Missing Providers | Medium |
| 6        | #14 - Extract Shared Utilities     | Low    |
| 7        | #17,#18 - Security Hardening       | Low    |
| 8        | #9 - Add Test Suite                | High   |

---

## Verification Notes

Since no automated tests exist:

1. **Manual testing** is currently the only verification method
2. Run `npm run build` to check for TypeScript errors
3. Run `npm run lint` for linting issues
4. Start dev servers with `bunx convex dev` and `bun dev`

For any fixes, I recommend:

1. Run build after each change
2. Test affected UI flows manually
3. Consider adding tests incrementally
