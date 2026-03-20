# Fix LLM Credential Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken LLM credential resolution so user API keys work, system credentials respect enabled/disabled state, and the correct model is always sent to the correct provider.

**Architecture:** Create an internal `getUserConfigInternal` action that returns the full decrypted config (including apiKey) for server-side use. Update all 8 generation actions to use it. Keep the existing `getUserConfig` for frontend use. Add test coverage for the credential resolution flow.

**Tech Stack:** Convex (actions, internal actions), TypeScript, Vitest

---

### Task 1: Add `getUserConfigInternal` action

**Files:**
- Modify: `convex/userConfigActions.ts`

**Step 1: Add the internal action import**

At top of `convex/userConfigActions.ts`, change:
```typescript
import { action } from './_generated/server';
```
to:
```typescript
import { action, internalAction } from './_generated/server';
```

Also add `internal` to the API import:
```typescript
import { api, internal as internalApi } from './_generated/api';
```

**Step 2: Add `getUserConfigInternal` after the existing `getUserConfig` action (after line 60)**

```typescript
/**
 * Internal version of getUserConfig that returns the full decrypted config
 * including the API key. Only callable from other server-side actions.
 */
export const getUserConfigInternal = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<UserConfig | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config: any = await ctx.runQuery(api.userConfigs.getUserConfigRaw);
    if (!config) return null;

    // Decrypt the API key
    let decryptedApiKey: string | undefined;
    if (config.apiKey) {
      try {
        const encrypted = JSON.parse(
          Buffer.from(config.apiKey).toString('utf8')
        );
        decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);
      } catch {
        decryptedApiKey = undefined;
      }
    }

    return {
      userId: config.userId,
      provider: config.provider,
      apiKey: decryptedApiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
      systemKeyId: config.systemKeyId,
      zaiEndpointType: config.zaiEndpointType,
      zaiIsChina: config.zaiIsChina,
    };
  },
});
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add convex/userConfigActions.ts
git commit -m "feat: add getUserConfigInternal action for server-side credential access"
```

---

### Task 2: Update all generation actions to use `getUserConfigInternal`

**Files:**
- Modify: `convex/actions/generatePhase.ts:123-126`
- Modify: `convex/actions/generateQuestions.ts:231-234`
- Modify: `convex/actions/generateQuestionAnswer.ts:81-84`
- Modify: `convex/actions/generateAllQuestionAnswers.ts:66-69`
- Modify: `convex/actions/generateQuickSpec.ts:53-56`
- Modify: `convex/actions/enhancePrompt.ts:200-203`
- Modify: `convex/actions/verifyImplementation.ts:93-96`
- Modify: `convex/actions/generateSectionPlan.ts:69-72`

**Step 1: In each file, change the import from `api` to include `internal`**

Each file already imports `api` and some import `internal as internalApi`. Ensure each file has:
```typescript
import { api, internal as internalApi } from '../_generated/api';
```

**Step 2: In each file, replace the `getUserConfig` call**

Replace this pattern (found in all 8 files):
```typescript
const userConfig = await ctx.runAction(
  api.userConfigActions.getUserConfig,
  {},
);
```

With:
```typescript
const userConfig = await ctx.runAction(
  internalApi.userConfigActions.getUserConfigInternal,
  {},
);
```

**Exact locations:**
| File | Line |
|------|------|
| `generatePhase.ts` | 123-126 |
| `generateQuestions.ts` | 231-234 |
| `generateQuestionAnswer.ts` | 81-84 |
| `generateAllQuestionAnswers.ts` | 66-69 |
| `generateQuickSpec.ts` | 53-56 |
| `enhancePrompt.ts` | 200-203 |
| `verifyImplementation.ts` | 93-96 |
| `generateSectionPlan.ts` | 69-72 |

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/actions/generatePhase.ts convex/actions/generateQuestions.ts convex/actions/generateQuestionAnswer.ts convex/actions/generateAllQuestionAnswers.ts convex/actions/generateQuickSpec.ts convex/actions/enhancePrompt.ts convex/actions/verifyImplementation.ts convex/actions/generateSectionPlan.ts
git commit -m "fix: use getUserConfigInternal in all generation actions to preserve API keys"
```

---

### Task 3: Add test for `resolveCredentials` with user API key

**Files:**
- Modify: `lib/llm/__tests__/credentials.test.ts`

**Step 1: Add test cases to the existing credentials test file**

Append these tests inside the existing `describe("resolveCredentials", ...)` block:

```typescript
  it("uses user api key even when system credentials exist for different provider", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "deepseek",
        apiKey: "user-deepseek-key",
        defaultModel: "deepseek-chat",
        useSystem: false,
      },
      new Map([
        ["openai", { apiKey: "system-openai-key" }],
      ])
    );

    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("user-deepseek-key");
    expect(result?.modelId).toBe("deepseek-chat");
  });

  it("returns null when no credentials are available", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "openai",
        defaultModel: "gpt-4o",
        useSystem: false,
      },
      new Map()
    );

    expect(result).toBeNull();
  });

  it("uses system credential for user provider when user has no api key", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "deepseek",
        defaultModel: "deepseek-chat",
        useSystem: true,
      },
      new Map([
        ["deepseek", { apiKey: "system-deepseek-key" }],
        ["openai", { apiKey: "system-openai-key" }],
      ])
    );

    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("system-deepseek-key");
  });

  it("falls back to system credential when user provider has no system key", () => {
    const result = resolveCredentials(
      {
        userId: "u",
        provider: "chutes",
        defaultModel: "some-model",
        useSystem: true,
      },
      new Map([
        ["deepseek", { apiKey: "system-deepseek-key" }],
      ])
    );

    // chutes has no system credential, should fall back to deepseek
    expect(result?.provider).toBe("deepseek");
    expect(result?.apiKey).toBe("system-deepseek-key");
  });
```

**Step 2: Run the test to verify it passes**

Run: `npm test -- lib/llm/__tests__/credentials.test.ts`
Expected: All tests PASS (these test current behavior, which is correct in `resolveCredentials` itself — the bug is in the caller stripping apiKey)

**Step 3: Commit**

```bash
git add lib/llm/__tests__/credentials.test.ts
git commit -m "test: add credential resolution edge case coverage"
```

---

### Task 4: Add `resolveModelForCredentials` test coverage

**Files:**
- Modify: `lib/llm/__tests__/registry.test.ts`

**Step 1: Add imports and tests**

Add to the imports at top:
```typescript
import { describe, it, expect } from 'vitest';
import { getModelById, getProviderDisplayName, resolveModelForCredentials, getFallbackModel } from '../registry';
```

Add a new `describe` block after the existing one:

```typescript
describe('resolveModelForCredentials', () => {
  it('uses the model from credentials when it exists in registry', () => {
    const model = resolveModelForCredentials(
      { provider: 'deepseek', apiKey: 'key', modelId: 'deepseek-chat' },
      [],
      []
    );
    expect(model.id).toBe('deepseek-chat');
    expect(model.provider).toBe('deepseek');
  });

  it('trusts unknown model from credentials (not in registry)', () => {
    const model = resolveModelForCredentials(
      { provider: 'chutes', apiKey: 'key', modelId: 'deepseek-ai/DeepSeek-V3' },
      [],
      []
    );
    expect(model.id).toBe('deepseek-ai/DeepSeek-V3');
    expect(model.provider).toBe('chutes');
  });

  it('falls back to enabled model for provider when no modelId', () => {
    const model = resolveModelForCredentials(
      { provider: 'deepseek', apiKey: 'key', modelId: '' },
      [],
      [{ provider: 'deepseek', modelId: 'deepseek-chat', contextTokens: 128000, maxOutputTokens: 8000, defaultMax: 4000 }]
    );
    expect(model.id).toBe('deepseek-chat');
  });

  it('returns global fallback when no provider match exists', () => {
    const model = resolveModelForCredentials(
      { provider: 'unknown', apiKey: 'key', modelId: '' },
      [],
      []
    );
    const fallback = getFallbackModel();
    expect(model.id).toBe(fallback.id);
  });
});
```

**Step 2: Run the test**

Run: `npm test -- lib/llm/__tests__/registry.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add lib/llm/__tests__/registry.test.ts
git commit -m "test: add resolveModelForCredentials test coverage"
```

---

### Task 5: Verify end-to-end fix

**Step 1: Run full test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: All checks PASS

**Step 2: Commit any remaining fixes if needed**

---

## Summary of Changes

| File | Change |
|------|--------|
| `convex/userConfigActions.ts` | Add `getUserConfigInternal` internal action |
| `convex/actions/generatePhase.ts` | Use `getUserConfigInternal` |
| `convex/actions/generateQuestions.ts` | Use `getUserConfigInternal` |
| `convex/actions/generateQuestionAnswer.ts` | Use `getUserConfigInternal` |
| `convex/actions/generateAllQuestionAnswers.ts` | Use `getUserConfigInternal` |
| `convex/actions/generateQuickSpec.ts` | Use `getUserConfigInternal` |
| `convex/actions/enhancePrompt.ts` | Use `getUserConfigInternal` |
| `convex/actions/verifyImplementation.ts` | Use `getUserConfigInternal` |
| `convex/actions/generateSectionPlan.ts` | Use `getUserConfigInternal` |
| `lib/llm/__tests__/credentials.test.ts` | Add edge case tests |
| `lib/llm/__tests__/registry.test.ts` | Add `resolveModelForCredentials` tests |
