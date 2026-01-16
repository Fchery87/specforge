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
import { Sparkles, LayoutDashboard, Settings, Shield, Menu } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navLinks = (isAdmin: boolean) => [
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

function NavLinks() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();

  if (!isSignedIn) return null;

  const isAdmin = user?.publicMetadata?.role === "admin";
  const links = navLinks(isAdmin);

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

function AuthNav({ className }: { className?: string }) {
  const { isSignedIn, user } = useUser();

  if (isSignedIn && user) {
    return (
      <div className={cn("flex items-center gap-6", className)}>
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
    <div className={cn("flex items-center gap-6", className)}>
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

function MobileMenu() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const links = navLinks(isAdmin);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="fixed left-auto right-0 top-0 h-full w-[min(90vw,22rem)] translate-x-0 translate-y-0 rounded-none border-l-2 border-border bg-background p-0">
        <div className="flex h-full flex-col">
          <DialogTitle className="sr-only">Main menu</DialogTitle>
          <DialogDescription className="sr-only">
            Access site navigation and account actions.
          </DialogDescription>
          <div className="flex items-center gap-3 border-b-2 border-border px-6 py-5">
            <div className="w-7 h-7 bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <span className="text-lg font-bold uppercase tracking-tight">
              Menu
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isSignedIn ? (
              <div className="flex flex-col">
                {links.map((link) => {
                  const isActive = pathname?.startsWith(link.href);
                  const Icon = link.icon;

                  return (
                    <DialogClose key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          "flex items-center gap-3 border-b border-border/70 px-6 py-4 text-sm font-bold uppercase tracking-tight transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:text-primary"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </Link>
                    </DialogClose>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-6">
                <DialogClose asChild>
                  <Link
                    href={"/sign-in" as Route}
                    className="text-lg font-bold uppercase tracking-tight hover:text-primary transition-colors"
                  >
                    Login
                  </Link>
                </DialogClose>
                <Button asChild className="w-full">
                  <Link href="/dashboard">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
          {isSignedIn && user ? (
            <div className="flex items-center justify-between border-t-2 border-border px-6 py-5">
              <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
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
                    avatarBox:
                      "w-9 h-9 rounded-none border-2 border-[#DFE104]",
                    userButtonAvatarBox: "rounded-none border-2 border-[#DFE104]",
                    userButtonPopoverCard:
                      "!bg-zinc-900 border-2 border-[#DFE104]/40 rounded-none shadow-[0_0_30px_-8px_rgba(223,225,4,0.3)]",
                    userButtonPopoverMain: "!bg-zinc-900",
                    userButtonPopoverActions: "!bg-zinc-900 py-2",
                    userPreview: "!bg-zinc-900 p-4 border-b border-zinc-800",
                    userPreviewMainIdentifier:
                      "!text-zinc-100 font-bold uppercase tracking-tight text-base",
                    userPreviewSecondaryIdentifier:
                      "!text-zinc-400 text-xs uppercase tracking-wide",
                    userPreviewAvatarBox:
                      "rounded-none border-2 border-[#DFE104]",
                    userButtonPopoverActionButton:
                      "!bg-zinc-900 hover:!bg-zinc-800 rounded-none transition-colors px-4 py-3",
                    userButtonPopoverActionButton__manageAccount:
                      "hover:!bg-zinc-800",
                    userButtonPopoverActionButton__signOut:
                      "hover:!bg-zinc-800",
                    userButtonPopoverActionButtonText:
                      "!text-zinc-100 font-bold uppercase tracking-wide text-sm",
                    userButtonPopoverActionButtonIcon:
                      "!text-[#DFE104] w-5 h-5",
                    userButtonPopoverFooter: "hidden",
                  },
                }}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
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
        <div className="flex items-center gap-4">
          <AuthNav className="hidden md:flex" />
          <MobileMenu />
        </div>
      </div>
    </nav>
  );
}
