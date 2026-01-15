"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

export function SiteFooter() {
  const { isSignedIn, user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  return (
    <footer className="border-t-2 border-border bg-background py-12 mt-auto">
      <div className="container px-6 flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="flex flex-col gap-4 max-w-sm">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="text-2xl font-bold uppercase tracking-tighter">
              SpecForge
            </span>
          </Link>
          <p className="text-sm text-muted-foreground uppercase tracking-tight leading-relaxed">
            Idea → Specs → Handoff. 
            High-performance project architecture generation powered by elite AI.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-16">
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Platform</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/dashboard" className="text-sm font-bold uppercase tracking-tight hover:text-primary transition-colors">Dashboard</Link>
              <Link href="/settings/llm-config" className="text-sm font-bold uppercase tracking-tight hover:text-primary transition-colors">Settings</Link>
              {isAdmin && (
                <Link href="/admin/dashboard" className="text-sm font-bold uppercase tracking-tight hover:text-primary transition-colors">Admin</Link>
              )}
            </nav>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Legal</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/terms" className="text-sm font-bold uppercase tracking-tight hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="text-sm font-bold uppercase tracking-tight hover:text-primary transition-colors">Privacy Policy</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="container px-6 mt-12 pt-8 border-t border-border/50 flex justify-between items-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          © 2026 SpecForge. All rights reserved.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
          Built for the future of engineering.
        </p>
      </div>
    </footer>
  );
}
