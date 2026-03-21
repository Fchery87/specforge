"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div className="text-[25vw] font-bold uppercase tracking-tighter text-muted-foreground/[0.03] leading-none">
          ERROR
        </div>
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(223, 225, 4, 0.5) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(223, 225, 4, 0.5) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl">
        {/* Error code display */}
        <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-primary/40 mb-8">
          <div className="w-2 h-2 bg-primary animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            System Failure
          </span>
        </div>

        {/* Main error display */}
        <h1 className="text-[12vw] md:text-[8vw] font-bold uppercase tracking-tighter text-foreground leading-none mb-4">
          ERROR
        </h1>

        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-8" />

        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4">
          Something went wrong
        </h2>

        <p className="text-muted-foreground text-lg mb-2 max-w-md mx-auto">
          We&apos;ve encountered an unexpected error.
        </p>
        
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/60 mb-8">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={reset}
            size="lg"
            className="font-bold uppercase tracking-wide"
          >
            Try Again
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            asChild
            className="font-bold uppercase tracking-wide"
          >
            <Link href="/dashboard">
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-primary/20" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-primary/20" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-primary/20" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-primary/20" />
    </div>
  );
}
