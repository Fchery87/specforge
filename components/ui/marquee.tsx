import FastMarquee from "react-fast-marquee";
import { cn } from "@/lib/markdown";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: React.ReactNode;
  speed?: number;
}

export function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  children,
  speed = 50,
}: MarqueeProps) {
  return (
    <FastMarquee
      speed={speed}
      className={cn("overflow-hidden", className)}
      autoFill
      direction={reverse ? "right" : "left"}
      pauseOnHover={pauseOnHover}
    >
      {children}
    </FastMarquee>
  );
}
