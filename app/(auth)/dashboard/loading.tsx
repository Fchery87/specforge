import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-container py-8">
      {/* Header Skeleton */}
      <div className="mb-12">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-12 w-2/3 mb-4" />
        <Skeleton className="h-6 w-1/2" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-2 border-border p-4">
            <Skeleton className="h-8 w-12 mb-2" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border-2 border-border">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="border-t-2 border-border p-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
