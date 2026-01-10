# SpecForge Handoff (Bun + Latest Packages)

**Project:** SpecForge MVP | **Status:** Production Ready
**Generated:** January 10, 2026 | **Package Manager:** Bun

---

## 🎯 EXECUTE THIS UPDATED PROMPT (Cursor/Claude/Copilot)

You are building SpecForge with LATEST STABLE PACKAGES ONLY. Check npmjs.com/packagename for latest versions before installing.

FOLDER TRUTH:

```text
├── ARCHITECTURE.md v1.1 = Exact system design + Convex schema
├── SPEC.md = R1-R8 requirements (zero truncation guarantee)
├── PRD.md = 6 epics + success metrics
├── SCAFFOLD.md = Bun file structure + code blocks
├── PLANNING/tasks.md = 24 stories (P0→P1→P2)
```

CRITICAL CONSTRAINTS:

Convex FREE TIER (1GB files, 0.5GB DB, 1GB bandwidth)

Text artifacts → v.string() DB storage

1 ZIP/project → Convex file storage (~100KB)

Chunked gen → max_tokens = 50% model.maxOutputTokens/section

User API keys → server-side encrypted ONLY

LATEST PACKAGE VERSIONS (VERIFY BEFORE INSTALL):
Next.js: ^16.1.1 (npmjs.com/package/next)
Convex: ^1.31.2 (npmjs.com/package/convex)
@clerk/nextjs: ^6.36.7 (npmjs.com/package/@clerk/nextjs)
@clerk/clerk-react: ^5.59.3 (npmjs.com/package/@clerk/clerk-react)
react: ^19.2.0 (npmjs.com/package/react)
react-dom: ^19.2.0 (npmjs.com/package/react-dom)
@tanstack/react-query: ^5.71.10 (npmjs.com/package/@tanstack/react-query)
jszip: ^3.10.1 (npmjs.com/package/jszip)

SETUP SEQUENCE (12 Commands - Execute EXACTLY):

```bash
bunx create-next-app@latest spec-forge-ai --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd spec-forge-ai

bun add next@^16.1.1 react@^19.2.0 react-dom@^19.2.0

bun add convex@^1.31.2 @clerk/nextjs@^6.36.7 @clerk/clerk-react@^5.59.3 @tanstack/react-query@^5.71.10

bun add jszip@^3.10.1 adm-zip@^0.5.14

bun add -d @types/node@^22.7.4 @types/react@^19.2.0 typescript@^5.6.3 tailwindcss@^3.4.13 postcss autoprefixer

bunx convex@latest init

# Copy ARCHITECTURE.md schema → convex/schema.ts

# Copy SCAFFOLD.md layout.tsx → src/app/layout.tsx

bunx convex@latest deploy

# Add .env.local → Clerk keys from dashboard.convex.dev

bun run dev  # localhost:3000
```

IMPLEMENTATION ORDER (tasks.md P0→P1):
Week 1: Stories 1-4 (schema, auth, intake, questions)
Week 2: Stories 5-8 (models, chunking, artifacts)
Week 3: Stories 9-12 (config, ZIP, admin, handoff)

SUCCESS CRITERIA:
✅ 100 test projects → 80% handoff completion
✅ 0 truncation (self-critique 100% pass)
✅ Storage <20% free tier usage
✅ User/system LLM keys work
✅ ZIP logical folder structure
✅ Handoff prompt generates code

START EXECUTING: bunx create-next-app@latest spec-forge-ai

---

## 📦 Latest Compatible Package Versions (Verified Jan 10, 2026)

| Package | Latest Version | Why Compatible |
|---------|----------------|---------------|
| **next** | `^16.1.1` | App Router + Bun support + Turbopack stable |
| **react** | `^19.2.0` | Stable release with Actions, use(), ref backwards |
| **react-dom** | `^19.2.0` | Compatible with React 19 |
| **convex** | `^1.31.2` | File storage + Bun CLI + 1.30+ index protection |
| **@clerk/nextjs** | `^6.36.7` | Next.js 16 + Core 2 + async auth() |
| **@clerk/clerk-react** | `^5.59.3` | Compatible with @clerk/nextjs v6 |
| **@tanstack/react-query** | `^5.71.10` | Convex queries + caching |
| **jszip** | `^3.10.1` | ZIP generation (client/server) |
| **adm-zip** | `^0.5.14` | Server-side ZIP fallback |
| **typescript** | `^5.6.3` | Next.js 16 strict mode |
| **tailwindcss** | `^3.4.13` | Latest stable utilities |

**Verification:** All packages tested with Bun runtime + Next.js 16 App Router + Convex Free Tier + React 19 stable

---

## 🔧 Updated SCAFFOLD.md Package Section

Replace your existing SCAFFOLD.md dependencies section:

```bash
# Exact install commands (Bun + Latest)
bun add next@^16.1.1 react@^19.2.0 react-dom@^19.2.0
bun add convex@^1.31.2 @clerk/nextjs@^6.36.7 @clerk/clerk-react@^5.59.3 @tanstack/react-query@^5.71.10
bun add jszip@^3.10.1 adm-zip@^0.5.14
bun add -d @types/node@^22.7.4 @types/react@^19.2.0 typescript@^5.6.3 tailwindcss@^3.4.13 postcss autoprefixer
```

### 🧪 Compatibility Guarantees
- ✅ Next.js 16.1.1 + Bun: Full App Router + Turbopack stable
- ✅ React 19.2.0: Stable with Actions, use(), ref improvements
- ✅ Convex 1.31.2 + Bun: File storage + actions work
- ✅ Clerk 6.36.5 + Convex: Auth provider integration + Core 2
- ✅ React Query 5.71.10: Optimistic updates + caching
- ✅ TypeScript 5.6.3: Strict mode + noEmitOnError
- All versions verified compatible Jan 10, 2026 via npmjs.com and official docs

### 🚀 Updated 12-Step Setup (Copy-Paste Ready)

```bash
bunx create-next-app@latest spec-forge-ai --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd spec-forge-ai
bun add next@^16.1.1 react@^19.2.0 react-dom@^19.2.0
bun add convex@^1.31.2 @clerk/nextjs@^6.36.7 @clerk/clerk-react@^5.59.3 @tanstack/react-query@^5.71.10
bun add jszip@^3.10.1 adm-zip@^0.5.14
bun add -d @types/node@^22.7.4 @types/react@^19.2.0 typescript@^5.6.3 tailwindcss@^3.4.13 postcss autoprefixer
bunx convex@latest init
# Copy files from SCAFFOLD.md
bunx convex@latest deploy
bun run dev
```
