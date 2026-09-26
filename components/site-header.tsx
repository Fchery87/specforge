"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LayoutDashboard, Zap, Settings, Shield, Menu } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";
import { clerkUserButtonAppearance } from "@/lib/clerk-theme";
import { cn } from "@/lib/utils";
import { SpecForgeLogo } from "@/components/ui/logo";

const navLinks = (isAdmin: boolean) => [
  {
    href: "/dashboard" as Route,
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/quick" as Route,
    label: "Quick spec",
    icon: Zap,
  },
  {
    href: "/settings" as Route,
    label: "Settings",
    icon: Settings,
  },
  ...(isAdmin
    ? [
        {
          href: "/admin/dashboard" as Route,
          label: "Admin",
          icon: Shield,
        },
      ]
    : []),
];

const isLinkActive = (href: string, pathname: string | null) =>
  href === "/dashboard"
    ? pathname === "/dashboard" || pathname === "/dashboard/new"
    : Boolean(pathname?.startsWith(href));

function NavLinks() {
  const { isSignedIn, user, isLoaded } = useUser();
  const pathname = usePathname();

  // Wait for client-side auth state so the markup does not change after hydration.
  if (!isLoaded || !isSignedIn) return null;

  const isAdmin = user?.publicMetadata?.role === "admin";

  return (
    <div className="hidden items-center gap-1 md:flex">
      {navLinks(isAdmin).map((link) => {
        const active = isLinkActive(link.href, pathname);
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-sm px-3 py-1.5 text-label transition-colors",
              "duration-(--duration-quick) ease-(--ease-quiet-out)",
              active
                ? "bg-raised text-ink"
                : "text-dim hover:bg-raised/60 hover:text-ink"
            )}
          >
            <Icon className="size-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function AuthNav({ className }: { className?: string }) {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) return null;

  if (isSignedIn && user) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <span className="hidden text-label text-dim lg:block">
          {user.firstName || user.username || "Signed in"}
        </span>
        <UserButton appearance={clerkUserButtonAppearance} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <Link
        href={"/sign-in" as Route}
        className="text-label text-dim transition-colors duration-(--duration-quick) ease-(--ease-quiet-out) hover:text-ink"
      >
        Sign in
      </Link>
      <Button asChild size="sm" className="hidden md:inline-flex">
        <Link href="/dashboard">Start a spec</Link>
      </Button>
    </div>
  );
}

function MobileMenu() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const links = navLinks(isAdmin);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="fixed top-0 right-0 left-auto h-full w-[min(88vw,20rem)] max-w-none gap-0 rounded-none rounded-l-lg border-y-0 border-r-0 border-l border-line bg-panel p-0">
        <div className="flex h-full flex-col">
          <DialogTitle className="sr-only">Main menu</DialogTitle>
          <DialogDescription className="sr-only">
            Site navigation and account actions.
          </DialogDescription>

          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <SpecForgeLogo size="sm" showWordmark={false} />
            <span className="text-label text-dim">Menu</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isSignedIn ? (
              <nav className="flex flex-col p-2">
                {links.map((link) => {
                  const active = isLinkActive(link.href, pathname);
                  const Icon = link.icon;

                  return (
                    <DialogClose key={link.href} asChild>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-sm px-3 py-2.5 text-ui transition-colors",
                          active ? "bg-raised text-ink" : "text-dim hover:text-ink"
                        )}
                      >
                        <Icon className="size-4" />
                        <span>{link.label}</span>
                      </Link>
                    </DialogClose>
                  );
                })}
              </nav>
            ) : (
              <div className="flex flex-col gap-4 p-5">
                <DialogClose asChild>
                  <Link
                    href={"/sign-in" as Route}
                    className="text-ui text-dim transition-colors hover:text-ink"
                  >
                    Sign in
                  </Link>
                </DialogClose>
                <Button asChild className="w-full">
                  <Link href="/dashboard">Start a spec</Link>
                </Button>
              </div>
            )}
          </div>

          {isSignedIn && user ? (
            <div className="flex items-center justify-between border-t border-line px-5 py-4">
              <span className="text-label text-dim">
                {user.firstName || user.username || "Signed in"}
              </span>
              <UserButton appearance={clerkUserButtonAppearance} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SiteHeader() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 h-(--header-height) border-b border-line bg-void">
      <div className="page-container flex h-full items-center justify-between gap-8">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-sm"
          aria-label="SpecForge home"
        >
          <SpecForgeLogo size="md" />
        </Link>
        <NavLinks />
        <div className="flex items-center gap-3">
          <AuthNav className="hidden md:flex" />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
