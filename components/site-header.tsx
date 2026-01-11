"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard, Settings, Shield } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

function NavLinks() {
  const { isSignedIn } = useUser();
  const pathname = usePathname();

  if (!isSignedIn) return null;

  const links: Array<{
    href: Route;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    {
      href: "/dashboard" as Route,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/settings/llm-config" as Route,
      label: "Settings",
      icon: Settings,
    },
    {
      href: "/admin/dashboard" as Route,
      label: "Admin",
      icon: Shield,
    },
  ];

  return (
    <div className="hidden md:flex items-center gap-1">
      {links.map((link) => {
        const isActive = pathname?.startsWith(link.href);
        const Icon = link.icon;
        
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-tight transition-colors relative group",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{link.label}</span>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function AuthNav() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn && user) {
    return (
      <div className="flex items-center gap-6">
        <span className="hidden lg:block text-lg font-medium text-muted-foreground uppercase tracking-tight">
          Hi, {user.firstName || "Forgemaster"}
        </span>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 rounded-none border-2 border-primary",
              userButtonPopoverCard: "bg-background border-2 border-border",
              userButtonPopoverActionButton: "text-foreground hover:bg-card",
              userButtonPopoverActionButtonText: "text-foreground",
              userButtonPopoverFooter: "hidden",
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
      <div className="w-full px-6 py-4 flex items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="text-2xl font-bold uppercase tracking-tighter">
            SpecForge
          </span>
        </Link>
        <NavLinks />
        <AuthNav />
      </div>
    </nav>
  );
}
