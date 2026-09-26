"use client";

import Link from "next/link";
import type { Route } from "next";
import { useUser } from "@clerk/nextjs";
import { SpecForgeLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const linkClass =
  "text-label text-dim transition-colors duration-(--duration-quick) ease-(--ease-quiet-out) hover:text-ink";

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: { href: Route; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-dim">{title}</p>
      <nav className="flex flex-col gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={linkClass}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function SiteFooter() {
  const { isSignedIn, user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  const productLinks: { href: Route; label: string }[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/quick", label: "Quick spec" },
    { href: "/settings", label: "Settings" },
    ...(isSignedIn && isAdmin
      ? [{ href: "/admin/dashboard" as Route, label: "Admin" }]
      : []),
  ];

  const legalLinks: { href: Route; label: string }[] = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-void">
      <div className="page-container flex flex-col gap-10 py-12 md:flex-row md:justify-between md:gap-16">
        <div className="flex max-w-sm flex-col gap-4">
          <Link href="/" className="flex w-fit items-center rounded-sm" aria-label="SpecForge home">
            <SpecForgeLogo size="md" />
          </Link>
          <p className="text-label leading-relaxed text-dim">
            Turn a product brief into evidence-backed specifications your coding agents can follow.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 sm:gap-20">
          <FooterGroup title="Product" links={productLinks} />
          <FooterGroup title="Legal" links={legalLinks} />
        </div>
      </div>

      <div className="page-container flex flex-col gap-3 border-t border-line py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-dim">© 2026 SpecForge</p>
        <div className="flex items-center gap-5">
          <p className="text-caption text-dim">Specification engineering for coding agents</p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
