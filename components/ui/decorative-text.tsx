// components/ui/decorative-text.tsx
// Large decorative background text elements for visual consistency

import { cn } from "@/lib/utils";

interface DecorativeTextProps {
  /** Text to display */
  text: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  variant?: "hero" | "section" | "background" | "project";
  /** Position variant */
  position?: "center" | "bottom" | "top";
  /** Opacity level (0-100) */
  opacity?: number;
}

/**
 * Large decorative text for background/atmosphere.
 * Used throughout the app for consistent visual identity.
 * 
 * @example
 * <DecorativeText text="FORGE" variant="hero" />
 * <DecorativeText text="CREATE" variant="background" position="bottom" />
 */
export function DecorativeText({
  text,
  className,
  variant = "background",
  position = "center",
  opacity = 5,
}: DecorativeTextProps) {
  const variants = {
    hero: "text-[15vw] md:text-[12vw]",
    section: "text-[12vw] md:text-[8vw]",
    background: "text-[20vw] md:text-[15vw]",
    project: "text-[12vw] font-bold leading-none",
  };

  const positions = {
    center: "absolute inset-0 flex items-center justify-center",
    bottom: "absolute bottom-0 left-0 right-0 text-center translate-y-1/4",
    top: "absolute top-0 left-0 right-0 text-center -translate-y-1/4",
  };

  return (
    <div
      className={cn(
        "font-bold uppercase tracking-tighter pointer-events-none select-none overflow-hidden",
        "text-muted-foreground",
        variants[variant],
        positions[position],
        className
      )}
      style={{ opacity: opacity / 100 }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
