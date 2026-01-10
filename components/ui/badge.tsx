import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/markdown";

const badgeVariants = cva("inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-accent text-black border-transparent",
      secondary: "bg-white/10 text-white border-transparent",
      destructive: "bg-red-500 text-white border-transparent",
      outline: "border-border text-white/80",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
