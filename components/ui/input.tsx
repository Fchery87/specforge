import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full bg-transparent ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/50 placeholder:uppercase focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200",
  {
    variants: {
      inputSize: {
        default: "h-14 border-2 border-input px-4 text-base focus-visible:border-primary",
        hero: "h-24 border-b-2 border-input px-0 py-2 text-3xl md:text-4xl font-bold uppercase tracking-tighter focus-visible:border-primary",
        minimal: "h-12 border-b border-input px-0 py-2 text-base focus-visible:border-primary",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
