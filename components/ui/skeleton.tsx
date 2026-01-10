import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-skeleton bg-muted/50",
        className
      )}
    />
  );
}

function TextSkeleton({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4 rounded-none",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "border-2 border-border bg-card p-8 space-y-4",
        className
      )}
    >
      <Skeleton className="h-8 w-1/3 rounded-none" />
      <TextSkeleton lines={2} />
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-14 w-32 rounded-none" />
        <Skeleton className="h-14 w-24 rounded-none" />
      </div>
    </div>
  );
}

function AvatarSkeleton({ className }: SkeletonProps) {
  return (
    <Skeleton
      className={cn("h-10 w-10 rounded-none", className)}
    />
  );
}

function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4 rounded-none",
            i === 0 ? "w-1/4" : "flex-1"
          )}
        />
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="page-container space-y-8">
      {/* Header */}
      <div className="page-header border-b-0">
        <Skeleton className="h-16 w-1/2 rounded-none mb-4" />
        <Skeleton className="h-6 w-2/3 rounded-none" />
      </div>
      {/* Content Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export {
  Skeleton,
  TextSkeleton,
  CardSkeleton,
  AvatarSkeleton,
  TableRowSkeleton,
  PageSkeleton,
};
