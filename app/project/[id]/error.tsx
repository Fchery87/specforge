"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project page error:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div className="text-[20vw] font-bold uppercase tracking-tighter text-muted-foreground/[0.03] leading-none">
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
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-destructive/40 mb-8">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>

        {/* Status indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-destructive/40 mb-8">
          <div className="w-2 h-2 bg-destructive animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-destructive">
            Project Error
          </span>
        </div>

        <h1 className="text-[8vw] md:text-[5vw] font-bold uppercase tracking-tighter text-foreground leading-none mb-4">
          Error
        </h1>

        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-destructive/50 to-transparent my-8" />

        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4">
          Failed to Load Project
        </h2>

        <p className="text-muted-foreground text-lg mb-2 max-w-md mx-auto">
          We encountered an error while loading this project.
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
