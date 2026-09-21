import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkBaseAppearance } from "@/lib/clerk-theme";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "@/lib/auth";
import { Toaster } from "sonner";
import { NoiseOverlay } from "@/components/ui/noise-overlay";

export const metadata: Metadata = {
  title: "SpecForge",
  description: "Idea → Specs → Handoff. Spec-driven project generator.",
};

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:top-4 focus:left-4 focus:font-bold focus:uppercase focus:tracking-wide focus:border-2 focus:border-primary"
        >
          Skip to main content
        </a>
        <NoiseOverlay />
        <ClerkProvider
          appearance={clerkBaseAppearance}
          afterSignOutUrl="/"
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ConvexClientProvider>
              <SiteHeader />
              <div className="flex flex-col min-h-screen">
                <main id="main-content" className="pt-20 flex-grow" tabIndex={-1}>
                  {children}
                </main>
                <SiteFooter />
              </div>
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
