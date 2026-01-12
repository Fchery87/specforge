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
            variables: {
              colorBackground: "#18181B",
              colorText: "#FAFAFA",
              colorPrimary: "#DFE104",
              colorTextSecondary: "#A1A1AA",
              borderRadius: "0px",
              fontFamily: "'Space Grotesk', sans-serif",
            },
            elements: {
              // Avatar in header
              avatarBox: "w-10 h-10 rounded-none border-2 border-[#DFE104]",
              userButtonAvatarBox: "rounded-none border-2 border-[#DFE104]",
              // Popover card (dropdown container)
              userButtonPopoverCard: "!bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)]",
              userButtonPopoverMain: "!bg-zinc-900",
              userButtonPopoverActions: "!bg-zinc-900 py-2",
              // User preview section at top of dropdown
              userPreview: "!bg-zinc-900 p-4 border-b border-zinc-800",
              userPreviewMainIdentifier: "!text-zinc-100 font-bold uppercase tracking-tight text-base",
              userPreviewSecondaryIdentifier: "!text-zinc-400 text-xs uppercase tracking-wide",
              userPreviewAvatarBox: "rounded-none border-2 border-[#DFE104]",
              // Action buttons
              userButtonPopoverActionButton: "!bg-zinc-900 hover:!bg-zinc-800 rounded-none transition-colors px-4 py-3",
              userButtonPopoverActionButton__manageAccount: "hover:!bg-zinc-800",
              userButtonPopoverActionButton__signOut: "hover:!bg-zinc-800",
              userButtonPopoverActionButtonText: "!text-zinc-100 font-bold uppercase tracking-wide text-sm",
              userButtonPopoverActionButtonIcon: "!text-[#DFE104] w-5 h-5",
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
