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
    <div className="sticky top-20 z-40 border-b-2 border-border bg-background/95 backdrop-blur-md">
      <div className="page-container py-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">
              Admin Console
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/40">
              System
            </span>
          </div>
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
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border border-transparent",
                  isActive
                    ? "bg-primary text-black border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Exit Admin */}
        <div className="hidden lg:flex items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            <span>Exit Admin</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
