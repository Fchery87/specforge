import type { ComponentProps } from "react";
import type { UserButton } from "@clerk/nextjs";

type Appearance = NonNullable<ComponentProps<typeof UserButton>["appearance"]>;

// Brand palette — single source of truth for all Clerk appearance objects
// Tailwind JIT can't resolve runtime template literals, so elements class
// strings use inlined hex values. The variables objects reference the const.
const COLORS = {
  primary: "#DFE104",
  background: "#18181B",
  foreground: "#FAFAFA",
  mutedForeground: "#A1A1AA",
  inputBackground: "#27272A",
  inputForeground: "#FAFAFA",
  danger: "#EF4444",
} as const;

export const clerkBaseAppearance: Appearance = {
  theme: 'clerk',
  variables: {
    colorBackground: COLORS.background,
    colorForeground: COLORS.foreground,
    colorPrimary: COLORS.primary,
    colorMutedForeground: COLORS.mutedForeground,
    colorInput: COLORS.inputBackground,
    colorInputForeground: COLORS.inputForeground,
    colorDanger: COLORS.danger,
    borderRadius: "0px",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  elements: {
    userButtonPopoverCard:
      "bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)] font-grotesk",
    userButtonPopoverMain: "bg-zinc-900",
    userButtonPopoverActions: "bg-zinc-900",
    userButtonPopoverActionButton:
      "hover:bg-zinc-800 rounded-none transition-colors",
    userButtonPopoverActionButton__manageAccount: "hover:bg-zinc-800",
    userButtonPopoverActionButton__signOut: "hover:bg-zinc-800",
    userButtonPopoverActionButtonText:
      "text-zinc-100 font-bold uppercase tracking-wide text-sm",
    userButtonPopoverActionButtonIcon: "text-[#DFE104] w-5 h-5",
    userButtonPopoverFooter: "hidden",
    userPreview: "bg-zinc-900",
    userPreviewMainIdentifier:
      "text-zinc-100 font-bold uppercase tracking-tight",
    userPreviewSecondaryIdentifier:
      "text-zinc-400 text-xs uppercase tracking-wide",
    userPreviewAvatarBox: "rounded-none border-2 border-[#DFE104]",
    avatarBox: "rounded-none border-2 border-[#DFE104]",
    card: "bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_40px_-8px_rgba(223,225,4,0.3)]",
    formFieldLabel:
      "text-zinc-300 font-bold uppercase tracking-wide text-xs",
    formFieldInput:
      "border-2 border-zinc-700 rounded-none focus:border-[#DFE104] bg-zinc-800 text-zinc-100",
    formButtonPrimary:
      "bg-[#DFE104] text-black font-bold uppercase tracking-wide rounded-none hover:bg-[#DFE104]/90",
    footerActionText: "text-zinc-400",
    footerActionLink:
      "text-[#DFE104] font-bold uppercase hover:text-[#DFE104]/90",
  },
};

export const clerkUserButtonAppearance: Appearance = {
  variables: {
    colorBackground: COLORS.background,
    colorForeground: COLORS.foreground,
    colorPrimary: COLORS.primary,
    colorMutedForeground: COLORS.mutedForeground,
    borderRadius: "0px",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  elements: {
    avatarBox: "w-10 h-10 rounded-none border-2 border-[#DFE104]",
    userButtonAvatarBox: "rounded-none border-2 border-[#DFE104]",
    userButtonPopoverCard:
      "!bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)]",
    userButtonPopoverMain: "!bg-zinc-900",
    userButtonPopoverActions: "!bg-zinc-900 py-2",
    userPreview: "!bg-zinc-900 p-4 border-b border-zinc-800",
    userPreviewMainIdentifier:
      "!text-zinc-100 font-bold uppercase tracking-tight text-base",
    userPreviewSecondaryIdentifier:
      "!text-zinc-400 text-xs uppercase tracking-wide",
    userPreviewAvatarBox: "rounded-none border-2 border-[#DFE104]",
    userButtonPopoverActionButton:
      "!bg-zinc-900 hover:!bg-zinc-800 rounded-none transition-colors px-4 py-3",
    userButtonPopoverActionButton__manageAccount: "hover:!bg-zinc-800",
    userButtonPopoverActionButton__signOut: "hover:!bg-zinc-800",
    userButtonPopoverActionButtonText:
      "!text-zinc-100 font-bold uppercase tracking-wide text-sm",
    userButtonPopoverActionButtonIcon: "!text-[#DFE104] w-5 h-5",
    userButtonPopoverFooter: "hidden",
  },
};

export const clerkAuthAppearance: Appearance = {
  variables: {
    colorPrimary: COLORS.primary,
    colorBackground: COLORS.background,
    colorForeground: COLORS.foreground,
    colorMutedForeground: COLORS.mutedForeground,
    colorInput: COLORS.inputBackground,
    colorInputForeground: COLORS.inputForeground,
    colorDanger: COLORS.danger,
    borderRadius: "0px",
  },
  elements: {
    card: "border-2 border-primary/40 shadow-[0_0_40px_-8px_rgba(223,225,4,0.3)] bg-zinc-900/95 backdrop-blur-sm",
    headerTitle:
      "font-bold uppercase tracking-tighter text-2xl text-foreground",
    headerSubtitle: "text-zinc-400 font-medium",
    socialButtonsBlockButton:
      "border-2 border-zinc-700 hover:border-primary/60 hover:bg-zinc-800 rounded-none text-zinc-200 font-bold uppercase tracking-wide transition-all focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-zinc-900",
    dividerLine: "bg-zinc-700",
    dividerText: "text-zinc-500 font-bold uppercase",
    formFieldLabel: "text-zinc-300 font-bold uppercase tracking-wide text-xs",
    formFieldInput:
      "border-2 border-zinc-700 rounded-none focus:border-primary focus:ring-0 bg-zinc-800 text-foreground placeholder:text-zinc-500",
    formButtonPrimary:
      "bg-primary text-black hover:bg-primary/90 rounded-none font-bold uppercase tracking-wide border-2 border-primary transition-all active:translate-y-0.5 shadow-[0_0_20px_-4px_rgba(223,225,4,0.4)]",
    footerActionText: "text-zinc-400",
    footerActionLink:
      "text-primary hover:text-primary/90 font-bold uppercase no-underline hover:underline",
    identityPreviewText: "text-zinc-200 font-bold",
    identityPreviewEditButton:
      "text-primary hover:text-primary/90 font-bold uppercase",
    formFieldWarningText: "text-amber-400",
    formFieldErrorText: "text-red-400 font-bold",
    alertText: "text-red-400 font-bold",
    formFieldInputShowPasswordButton: "text-zinc-400 hover:text-primary",
  },
  options: {
    socialButtonsPlacement: "bottom",
    socialButtonsVariant: "blockButton",
  },
};
