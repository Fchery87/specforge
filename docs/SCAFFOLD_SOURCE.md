# SpecForge Scaffold

**Version:** 1.0  
**Purpose:** Exact folder structure + file stubs for MVP implementation  
**Generated:** January 10, 2026  
**Next Step:** Copy this structure → `npx create-next-app spec-forge-ai`

---

## Root Structure

```text
spec-forge-ai/
├── README.md                     # Project overview
├── ARCHITECTURE.md               # ✅ Generated
├── SPEC.md                       # ✅ Generated
├── PRD.md                        # ✅ Generated
├── PLANNING/
│   ├── brief.md                  # ✅ Generated
│   └── tasks.md                  # ✅ Generated
├── public/
│   └── specforge-logo.png
├── app/
│   ├── globals.css
│   ├── layout.tsx                # Clerk + Convex providers
│   ├── favicon.ico
│   └── page.tsx                  # Landing page
├── components/
│   ├── ui/                       # Shadcn components
│   ├── PhaseStepper.tsx
│   ├── QuestionsPanel.tsx
│   ├── ArtifactPreview.tsx
│   └── AdminDashboard.tsx
├── lib/
│   ├── convex.ts                 # Convex client config
│   ├── utils.ts                  # Helpers
│   └── types.ts                  # Shared types
├── convex/
│   ├── convex.config.ts
│   ├── schema.ts                 # ✅ From ARCHITECTURE.md
│   └── functions/
│       ├── auth.ts
│       ├── projects.ts           # CRUD
│       ├── phases.ts             # Questions + status
│       ├── artifacts.ts          # Storage + preview
│       └── llm.ts                # Generation engine
└── package.json
```

---

## Critical Files (Copy These First)

### 1) `convex/schema.ts` (From `ARCHITECTURE.md` v1.1)

Copy the **exact schema** from `ARCHITECTURE.md` into `convex/schema.ts`, then deploy:

```bash
npx convex deploy
```

### 2) `app/layout.tsx` (Auth Skeleton)

```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={true}>
        <html lang="en">
          <body>{children}</body>
        </html>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### 3) `convex/functions/projects.ts` (Core CRUD)

```ts
// Copy: createProject, getProject, listUserProjects from ARCHITECTURE.md
```

### 4) `components/PhaseStepper.tsx` (UI Skeleton)

```tsx
export function PhaseStepper({ phases, currentPhase }) {
  return (
    <div className="stepper">
      {phases.map((phase) => (
        <div key={phase.id} className={`step ${phase.id === currentPhase ? "active" : ""}`}>
          {phase.name}
          <span>{phase.status}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Setup Commands (Run in Order)

```bash
# 1. Scaffold Next.js
npx create-next-app@latest spec-forge-ai --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 2. Install dependencies
cd spec-forge-ai
npm i convex react-query @clerk/nextjs @clerk/clerk-react
npm i -D @types/node jszip adm-zip

# 3. Initialize Convex
npx convex init

# 4. Copy schema → convex/schema.ts
# 5. Deploy schema
npx convex deploy

# 6. Clerk setup (dashboard.convex.dev)
#    Add your Clerk publishable key to .env.local

# 7. Run dev
npm run dev
File-by-File Implementation Order
```

---

## File-by-File Implementation Order

### Week 1 (Core Loop)

1. convex/schema.ts → `npx convex deploy`
2. app/layout.tsx → Auth working
3. lib/convex.ts → Client connected
4. app/(app)/new/page.tsx → Project intake form
5. convex/functions/projects.ts → CRUD working
6. app/dashboard/page.tsx → Project list

### Week 2 (Phase 1)

1. components/QuestionsPanel.tsx
2. convex/functions/phases.ts
3. app/project/[id]/phase/[phaseId]/page.tsx

### Week 3 (Generation)

1. convex/functions/llm.ts → Chunked engine
2. components/ArtifactPreview.tsx

### Week 4 (Polish)

1. app/settings/llm/page.tsx
2. app/admin/dashboard/page.tsx
3. convex/actions/generateProjectZip.ts


---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Convex dashboard (admin only):
SYSTEM_OPENAI_API_KEY="sk-..."
SYSTEM_ANTHROPIC_API_KEY="..."
```

---

## Testing Checklist

- [ ] npx convex deploy → No schema errors
- [ ] npm run dev → Landing + auth working
- [ ] Create project → Redirects to phase/brief
- [ ] Answer questions → Phase advances
- [ ] Generate Phase 1 → PRD appears in preview
- [ ] Download MD → Correct content
- [ ] Storage dashboard → <10% usage

---

## Story Mapping to Files

- Story 01 (Schema) → convex/schema.ts
- Story 02 (Auth)   → app/layout.tsx
- Story 03 (Intake) → app/(app)/new/page.tsx
- Story 04 (Questions) → components/QuestionsPanel.tsx
- Story 05 (Models) → convex/functions/llm.ts
- ...

This scaffold is your "zero to working prototype" blueprint. Follow exactly, no deviations.
Save as `SCAFFOLD.md`. This is your **"copy-paste to production"** guide—team members can build the entire MVP by following this file sequentially. No guesswork, no meetings needed.

> Save this file as `SCAFFOLD.md`. It’s the **copy‑paste to production** guide—team members can build the MVP sequentially with no guesswork.
