# PR4 visual parity checklist (operator side)

Live lanes are blocked in the build sandbox. Node egress hangs there, so no
local page renders. The migration itself is verified by build plus suite.
This checklist completes the review gate on a machine that can run the app.

## Automated evidence (already collected)

- `npm run build` exits 0 with the full 20 route table.
- Compiled CSS is 92604 bytes and contains the acid yellow token (47 refs),
  grotesk fonts, v-hero scale, skeleton-pulse keyframes, fade-in keyframes
  from tw-animate-css, and the grid pattern utilities.
- Full vitest suite green, including cn() utility tests under tailwind-merge 3.

## Manual pass (about five minutes)

1. `npm run dev` plus `npm run convex`, open http://localhost:3000.
2. Landing light and dark. Layout, spacing, acid yellow accents match memory.
3. Dashboard light and dark. Cards, sidebar, stat tiles render styled.
4. One project phase page with an artifact. Markdown and mermaid render.
5. Admin dashboard. Tables and badges render styled.
6. Sign-in page. Clerk component renders styled.
7. Open a dialog and a dropdown. Overlay animations run.
8. Phase page at 390px width. Breakpoints hold.
9. Toggle theme three times fast. No unstyled flash.

## Sign off

Reply with go or with the lane number and a screenshot of any drift.
Record a 30 to 60 second video of landing, dashboard, and a dialog open
only if you want the full gate artifact.
