"use client";

import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";

function AuthNav() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn && user) {
    return (
      <div className="flex items-center gap-6">
        <span className="hidden md:block text-lg font-medium text-muted-foreground uppercase tracking-tight">
          Hi, {user.firstName || "Forgemaster"}
        </span>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 rounded-none border-2 border-primary",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <Link
        href={"/sign-in" as Route}
        className="text-lg font-bold uppercase tracking-tight hover:text-primary transition-colors"
      >
        Login
      </Link>
      <Button asChild className="hidden md:inline-flex">
        <Link href="/dashboard">Get Started</Link>
      </Button>
    </div>
  );
}

export function SiteHeader() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b-2 border-border bg-background/90 backdrop-blur-sm">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="text-2xl font-bold uppercase tracking-tighter">
            SpecForge
          </span>
        </Link>
        <AuthNav />
      </div>
    </nav>
  );
}
