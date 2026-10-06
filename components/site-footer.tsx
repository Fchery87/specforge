import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="page-container flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-dim">© 2026 SpecForge</p>
        <nav className="flex items-center gap-5" aria-label="Legal">
          <Link
            href="/terms"
            className="text-caption text-dim transition-colors duration-(--duration-quick) ease-(--ease-quiet-out) hover:text-ink"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-caption text-dim transition-colors duration-(--duration-quick) ease-(--ease-quiet-out) hover:text-ink"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
