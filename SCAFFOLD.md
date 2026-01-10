# SCAFFOLD.md (COMPLETE) — **SpecForge**
For existing `specforge/` folder | **Next.js 16 + Bun + shadcn/ui + Dark Mode + Enterprise Scaling**
Updated: **Jan 10, 2026** | New: **Dynamic scaling (startup→enterprise)** + **universal LLM detection**

> This scaffold is designed to be **repo-native**, **spec-driven**, and **LLM-agnostic**.
> It ships with a minimal working Next.js 16 + Convex + Clerk app and the folder structure
> needed to generate/preview/download artifacts per phase — plus export a full project ZIP.

---

## 🎯 Current State Check

```bash
cd specforge
bun --version  # 1.1.x+
ls package.json tailwind.config.js  # Should exist
```

---

## 📦 Install + Universal Scaling (17 Commands)

```bash
cd specforge

# 1. Clean install
rm -rf node_modules bun.lockb
bun install

# 2. Core + scaling deps
bun add next@^16.0.1 react@^18.3.1 react-dom@^18.3.1
bun add convex@^1.22.0 @clerk/nextjs@^5.6.0 @clerk/clerk-react@^5.6.0 @tanstack/react-query@^5.60.0
bun add jszip@^3.10.1 adm-zip@^0.5.14 lucide-react clsx tailwind-merge next-themes

# 3. shadcn/ui (brutalist UI)
npx shadcn-ui@latest init  # slate base, default style, CSS vars: yes
npx shadcn-ui@latest add button card input textarea badge progress dialog popover sheet tabs accordion
bun add -d tailwindcss-animate

# 4. Types
bun add -d @types/node@^22.7.4 @types/react@^18.3.11 typescript@^5.6.3

# 5. Convex + deploy schema
bunx convex@latest init
bunx convex@latest deploy

# 6. Test
bun run dev
```

---

## 🧩 Environment Setup

Copy `.env.example` → `.env.local` and fill in keys.

- Clerk requires:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
- Convex requires:
  - `NEXT_PUBLIC_CONVEX_URL` (from Convex dashboard)

**System LLM keys** (optional) should be stored as Convex environment variables (server-only).

---

## 📁 Full File Structure (Generated)

```text
specforge/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth-protected areas
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   ├── settings/llm-config/page.tsx
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       └── llm-models/page.tsx
│   ├── project/[id]/
│   │   ├── page.tsx
│   │   └── phase/[phaseId]/page.tsx
│   ├── api/
│   │   └── health/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── phase-stepper.tsx
│   ├── artifact-preview.tsx
│   └── ui/                       # shadcn-like components (minimal set included)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── badge.tsx
│       ├── progress.tsx
│       ├── dialog.tsx
│       ├── popover.tsx
│       ├── sheet.tsx
│       ├── tabs.tsx
│       └── accordion.tsx
├── convex/
│   ├── schema.ts
│   ├── projects.ts
│   ├── artifacts.ts
│   ├── llmModels.ts
│   ├── actions/
│   │   ├── generatePhase.ts
│   │   └── generateProjectZip.ts
│   └── _generated/               # created by Convex (not committed in this scaffold)
├── lib/
│   ├── auth.tsx
│   ├── llm/
│   │   ├── registry.ts
│   │   └── chunking.ts
│   ├── markdown.ts
│   └── zip.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── HANDOFF.md
│   └── SCAFFOLD_SOURCE.md         # your last fixed scaffold (reference)
├── public/
│   └── icons/
├── research/
│   └── spec-driven-systems-research.pdf
├── .env.example
├── .gitignore
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## ✅ What This Scaffold Already Implements

- **Clerk auth** + protected routes (route shells included)
- **Convex** schema + basic CRUD for projects/phases/artifacts
- **Phase UI** (stepper + questions JSON preview + artifact preview + per-artifact download)
- **Anti-truncation foundation**
  - model registry fallback
  - section planning helper
  - sectioned generation stub (replace with provider calls)
- **ZIP export plumbing**
  - server-side action that zips DB-stored artifacts into a downloadable ZIP

---

## 🔧 Config Files (Copy All)

### `tailwind.config.js` (Brutalist + Dark Mode)
```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        grotesk: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg: "#0F0F0F",
        card: "#1A1A1A",
        accent: "#FF6B35",
        border: "#FF6B35",
      },
      boxShadow: {
        brutal: "0 8px 32px rgba(255,107,53,0.3)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### `postcss.config.js`
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

### `next.config.js`
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
};

export default nextConfig;
```

---

## 🧪 Run

```bash
bun run dev
# open http://localhost:3000
```

---

## 📌 Next Steps

1. Replace the placeholder LLM provider adapters in `lib/llm/*` with OpenAI/Anthropic/Mistral clients.
2. Implement `convex/actions/generatePhase.ts` to:
   - resolve credential source (system vs user)
   - generate artifacts section-by-section
   - self-check + refine incomplete sections
   - stitch and store results in `artifacts`
3. Implement admin pages to manage providers/models + limits.
