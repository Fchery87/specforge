"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * The theme switch. Renders a placeholder of the same size until mounted, so the header and footer
 * do not shift when the resolved theme arrives.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="block h-5 w-14" aria-hidden />;
  }

  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to the light theme" : "Switch to the dark theme"}
      className="inline-flex items-center gap-1.5 rounded-sm text-caption text-dim transition-colors duration-(--duration-quick) ease-(--ease-quiet-out) hover:text-ink"
    >
      {isDark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      {isDark ? "Dark" : "Light"}
    </button>
  );
}
