import type { ComponentProps } from "react";
import type { UserButton } from "@clerk/nextjs";

type Appearance = NonNullable<ComponentProps<typeof UserButton>["appearance"]>;

/**
 * Clerk appearance for the SpecForge theme.
 *
 * Everything here reads from the token layer in app/globals.css, so both themes follow without a
 * second set of values. Clerk's own CSS and any inline style it writes both resolve var() at
 * runtime. The class strings stay on semantic token utilities rather than raw values.
 */

const variables = {
  colorBackground: "var(--panel)",
  colorForeground: "var(--ink)",
  colorPrimary: "var(--brand)",
  colorMutedForeground: "var(--ink-muted)",
  colorInput: "var(--surface)",
  colorInputForeground: "var(--ink)",
  colorDanger: "var(--destructive)",
  colorSuccess: "var(--success)",
  colorWarning: "var(--warning)",
  borderRadius: "10px",
  fontFamily: "var(--font-sans)",
} as const;

const controlBase =
  "rounded-sm border border-field bg-surface text-ink transition-colors duration-(--duration-quick) ease-(--ease-quiet-out)";

const overlayCard = "bg-panel border border-line rounded-lg shadow-lg";

const menuItem =
  "rounded-sm text-ink transition-colors duration-(--duration-quick) ease-(--ease-quiet-out)";

export const clerkBaseAppearance: Appearance = {
  variables,
  elements: {
    rootBox: "font-sans",
    card: overlayCard,
    userButtonPopoverCard: overlayCard,
    userButtonPopoverMain: "bg-panel",
    userButtonPopoverActions: "bg-panel",
    userButtonPopoverActionButton: menuItem,
    userButtonPopoverActionButton__manageAccount: "hover:bg-raised",
    userButtonPopoverActionButton__signOut: "hover:bg-raised",
    userButtonPopoverActionButtonText: "text-ui text-ink",
    userButtonPopoverActionButtonIcon: "size-4 text-dim",
    userButtonPopoverFooter: "hidden",
    userPreview: "bg-panel",
    userPreviewMainIdentifier: "text-ui font-medium text-ink",
    userPreviewSecondaryIdentifier: "text-label text-dim",
    userPreviewAvatarBox: "rounded-full",
    avatarBox: "size-7 rounded-full",
    formFieldLabel: "text-label text-dim",
    formFieldInput: controlBase,
    formButtonPrimary: "bg-brand text-void rounded-sm font-semibold hover:bg-brand/90 active:scale-[0.97] transition-transform",
    footerActionText: "text-label text-dim",
    footerActionLink: "text-label text-brand hover:underline",
  },
};

export const clerkUserButtonAppearance: Appearance = {
  variables,
  elements: {
    rootBox: "font-sans",
    avatarBox: "size-7 rounded-full",
    userButtonAvatarBox: "rounded-full",
    userButtonPopoverCard: overlayCard,
    userButtonPopoverMain: "bg-panel",
    userButtonPopoverActions: "bg-panel py-1",
    userPreview: "bg-panel border-b border-line p-3",
    userPreviewMainIdentifier: "text-ui font-medium text-ink",
    userPreviewSecondaryIdentifier: "text-label text-dim",
    userPreviewAvatarBox: "rounded-full",
    userButtonPopoverActionButton: `${menuItem} px-3 py-2`,
    userButtonPopoverActionButton__manageAccount: "hover:bg-raised",
    userButtonPopoverActionButton__signOut: "hover:bg-raised",
    userButtonPopoverActionButtonText: "text-ui text-ink",
    userButtonPopoverActionButtonIcon: "size-4 text-dim",
    userButtonPopoverFooter: "hidden",
  },
};

export const clerkAuthAppearance: Appearance = {
  variables,
  elements: {
    rootBox: "font-sans",
    card: "bg-surface border border-line rounded-lg shadow-none p-0",
    headerTitle: "text-title font-medium text-ink",
    headerSubtitle: "text-ui text-dim",
    socialButtonsBlockButton: `${controlBase} hover:bg-raised justify-center`,
    socialButtonsBlockButtonText: "text-ui text-ink",
    dividerLine: "bg-line",
    dividerText: "text-label text-dim",
    formFieldLabel: "text-label text-dim",
    formFieldInput: controlBase,
    formButtonPrimary: "bg-brand text-void rounded-sm font-semibold hover:bg-brand/90 active:scale-[0.97] transition-transform",
    footerActionText: "text-label text-dim",
    footerActionLink: "text-label text-brand hover:underline",
    identityPreviewText: "text-ui text-ink",
    identityPreviewEditButton: "text-label text-brand hover:underline",
    formFieldWarningText: "text-label text-warning",
    formFieldErrorText: "text-label text-destructive",
    alertText: "text-label text-destructive",
    formFieldInputShowPasswordButton: "text-dim hover:text-ink",
    otpCodeFieldInput: controlBase,
    formResendCodeLink: "text-label text-brand hover:underline",
    navbarButton: menuItem,
  },
  options: {
    socialButtonsPlacement: "bottom",
    socialButtonsVariant: "blockButton",
  },
};
