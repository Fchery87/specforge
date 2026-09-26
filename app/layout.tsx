import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkBaseAppearance } from "@/lib/clerk-theme";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpecForge | Specification Engineering for AI Agents",
  description:
    "Transform product requirements into rigorous software specifications, domain models, and agent-native handoff packs for Claude Code, Cursor, and Codex.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        inter.variable,
        sourceSerif.variable,
        jetbrainsMono.variable,
        "font-sans"
      )}
    >
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:rounded-sm focus:bg-ember focus:px-4 focus:py-2 focus:text-ui focus:font-medium focus:text-void"
        >
          Skip to main content
        </a>
        <ClerkProvider appearance={clerkBaseAppearance} afterSignOutUrl="/">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ConvexClientProvider>
              <div className="flex min-h-screen flex-col">
                <SiteHeader />
                <main
                  id="main-content"
                  className="flex-grow pt-(--header-height)"
                  tabIndex={-1}
                >
                  {children}
                </main>
                <SiteFooter />
              </div>
              <Toaster />
            </ConvexClientProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
