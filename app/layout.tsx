import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "@/lib/auth";

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
              colorBackground: "hsl(240 10% 3.9%)",
              colorText: "hsl(0 0% 98%)",
              colorPrimary: "hsl(61 96% 45%)",
              colorTextSecondary: "hsl(240 5% 64.9%)",
              colorInputBackground: "hsl(240 10% 3.9%)",
              colorInputText: "hsl(0 0% 98%)",
            },
          }}
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ConvexClientProvider>
              <SiteHeader />
              <main className="pt-20 min-h-screen">
                {children}
              </main>
            </ConvexClientProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
