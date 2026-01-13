import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "@/lib/auth";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "SpecForge",
  description: "Idea → Specs → Handoff. Spec-driven project generator.",
};

import { NoiseOverlay } from "@/components/ui/noise-overlay";

import { SiteHeader } from "@/components/site-header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <NoiseOverlay />
        <ClerkProvider
          appearance={{
            baseTheme: undefined,
            variables: {
              colorBackground: "#18181B",
              colorText: "#FAFAFA",
              colorPrimary: "#DFE104",
              colorTextSecondary: "#A1A1AA",
              colorInputBackground: "#27272A",
              colorInputText: "#FAFAFA",
              colorDanger: "#EF4444",
              borderRadius: "0px",
              fontFamily: "'Space Grotesk', sans-serif",
            },
            elements: {
              // UserButton Popover (dropdown)
              userButtonPopoverCard: "bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)] font-grotesk",
              userButtonPopoverMain: "bg-zinc-900",
              userButtonPopoverActions: "bg-zinc-900",
              userButtonPopoverActionButton: "hover:bg-zinc-800 rounded-none transition-colors",
              userButtonPopoverActionButton__manageAccount: "hover:bg-zinc-800",
              userButtonPopoverActionButton__signOut: "hover:bg-zinc-800",
              userButtonPopoverActionButtonText: "text-zinc-100 font-bold uppercase tracking-wide text-sm",
              userButtonPopoverActionButtonIcon: "text-[#DFE104] w-5 h-5",
              userButtonPopoverFooter: "hidden",
              // User preview in dropdown
              userPreview: "bg-zinc-900",
              userPreviewMainIdentifier: "text-zinc-100 font-bold uppercase tracking-tight",
              userPreviewSecondaryIdentifier: "text-zinc-400 text-xs uppercase tracking-wide",
              userPreviewAvatarBox: "rounded-none border-2 border-[#DFE104]",
              // Avatar
              avatarBox: "rounded-none border-2 border-[#DFE104]",
              // Cards and containers
              card: "bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_40px_-8px_rgba(223,225,4,0.3)]",
              // Forms
              formFieldLabel: "text-zinc-300 font-bold uppercase tracking-wide text-xs",
              formFieldInput: "border-2 border-zinc-700 rounded-none focus:border-[#DFE104] bg-zinc-800 text-zinc-100",
              formButtonPrimary: "bg-[#DFE104] text-black font-bold uppercase tracking-wide rounded-none hover:bg-[#DFE104]/90",
              // Footer
              footerActionText: "text-zinc-400",
              footerActionLink: "text-[#DFE104] font-bold uppercase hover:text-[#DFE104]/90",
            },
          }}
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ConvexClientProvider>
              <SiteHeader />
              <main className="pt-20 min-h-screen">
                {children}
              </main>
              <Toaster
                theme="dark"
                position="top-right"
                closeButton
                toastOptions={{
                  classNames: {
                    toast:
                      "bg-card border-2 border-border rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)] font-grotesk text-foreground",
                    title: "font-bold uppercase tracking-wide text-xs",
                    description: "text-xs text-muted-foreground",
                    success: "border-success/60",
                    error: "border-destructive/60",
                    warning: "border-warning/60",
                    info: "border-accent/60",
                  },
                }}
              />
            </ConvexClientProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
