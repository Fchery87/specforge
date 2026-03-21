// lib/clerk-theme.ts
// Centralized Clerk appearance configuration to eliminate duplication

import { Appearance } from "@clerk/types";

// Primary colors from design system
const COLORS = {
  primary: "#DFE104",      // Acid yellow
  background: "#18181B",   // Zinc 900
  foreground: "#FAFAFA",   // Zinc 50
  mutedForeground: "#A1A1AA", // Zinc 400
  inputBackground: "#27272A", // Zinc 800
  danger: "#EF4444",       // Red 500
} as const;

// Base Clerk appearance configuration
export const clerkBaseAppearance: Appearance = {
  variables: {
    colorBackground: COLORS.background,
    colorText: COLORS.foreground,
    colorPrimary: COLORS.primary,
    colorTextSecondary: COLORS.mutedForeground,
    colorInputBackground: COLORS.inputBackground,
    colorInputText: COLORS.foreground,
    colorDanger: COLORS.danger,
    borderRadius: "0px",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  elements: {
    // UserButton Popover (dropdown)
    userButtonPopoverCard: `bg-[${COLORS.background}] border-2 border-[${COLORS.primary}]/40 rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)] font-grotesk`,
    userButtonPopoverMain: `bg-[${COLORS.background}]`,
    userButtonPopoverActions: `bg-[${COLORS.background}]`,
    userButtonPopoverActionButton: "hover:bg-zinc-800 rounded-none transition-colors",
    userButtonPopoverActionButton__manageAccount: "hover:bg-zinc-800",
    userButtonPopoverActionButton__signOut: "hover:bg-zinc-800",
    userButtonPopoverActionButtonText: "text-zinc-100 font-bold uppercase tracking-wide text-sm",
    userButtonPopoverActionButtonIcon: `text-[${COLORS.primary}] w-5 h-5`,
    userButtonPopoverFooter: "hidden",
    // User preview in dropdown
    userPreview: `bg-[${COLORS.background}]`,
    userPreviewMainIdentifier: "text-zinc-100 font-bold uppercase tracking-tight",
    userPreviewSecondaryIdentifier: "text-zinc-400 text-xs uppercase tracking-wide",
    userPreviewAvatarBox: `rounded-none border-2 border-[${COLORS.primary}]`,
    // Avatar
    avatarBox: `rounded-none border-2 border-[${COLORS.primary}]`,
    // Cards and containers
    card: `bg-[${COLORS.background}] border-2 border-[${COLORS.primary}]/40 rounded-none shadow-[0_0_40px_-8px_rgba(223,225,4,0.3)]`,
    // Forms
    formFieldLabel: "text-zinc-300 font-bold uppercase tracking-wide text-xs",
    formFieldInput: `border-2 border-zinc-700 rounded-none focus:border-[${COLORS.primary}] bg-zinc-800 text-zinc-100`,
    formButtonPrimary: `bg-[${COLORS.primary}] text-black font-bold uppercase tracking-wide rounded-none hover:bg-[${COLORS.primary}]/90`,
    // Footer
    footerActionText: "text-zinc-400",
    footerActionLink: `text-[${COLORS.primary}] font-bold uppercase hover:text-[${COLORS.primary}]/90`,
  },
};

// Simplified appearance for UserButton component only
export const clerkUserButtonAppearance: Appearance = {
  variables: {
    colorPrimary: COLORS.primary,
    colorText: COLORS.foreground,
    colorBackground: COLORS.background,
    colorTextSecondary: COLORS.mutedForeground,
    colorInputBackground: COLORS.inputBackground,
    colorInputText: COLORS.foreground,
  },
  elements: {
    userButtonAvatarBox: "w-8 h-8 rounded-none border-2 border-primary",
    userButtonPopoverCard: "bg-card border-2 border-border rounded-none",
    userPreviewMainIdentifier: "font-semibold uppercase tracking-tight",
    userButtonPopoverFooter: "hidden",
  },
};

// Appearance for auth pages (sign-in, sign-up)
export const clerkAuthAppearance: Appearance = clerkBaseAppearance;
