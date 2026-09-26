"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Users,
  FolderOpen,
  Sparkles,
  BarChart3,
  Activity,
  Lock,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_NAV_ITEMS = [
  {
    href: "/admin/dashboard" as Route,
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/users" as Route,
    label: "Users",
    icon: Users,
  },
  {
    href: "/admin/projects" as Route,
    label: "Projects",
    icon: FolderOpen,
  },
  {
    href: "/admin/llm-models" as Route,
    label: "AI & Models",
    icon: Sparkles,
  },
  {
    href: "/admin/analytics" as Route,
    label: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/admin/health" as Route,
    label: "Health",
    icon: Activity,
  },
  {
    href: "/admin/security" as Route,
    label: "Security",
    icon: Lock,
  },
  {
    href: "/admin/settings" as Route,
    label: "Settings",
    icon: Settings,
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-20 z-40 border-b border-line bg-void/95">
      <div className="page-container py-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary flex items-center justify-center flex-shrink-0">
              <Shield className="size-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ui font-bold text-ink">
                Admin Console
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-caption font-bold bg-primary/20 text-primary border border-primary/40">
                System
              </span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="md:hidden flex items-center gap-1 px-2.5 py-1 text-caption font-bold text-muted-foreground hover:text-primary transition-colors border border-line/50 rounded-sm"
          >
            <span>Exit</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav
          className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none"
          aria-label="Admin Navigation"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold transition-colors whitespace-nowrap border border-transparent",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground hover:text-ink hover:bg-raised/40"
                )}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Exit Admin */}
        <div className="hidden md:flex items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 px-2.5 py-1 text-caption font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <span>Exit Admin</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
