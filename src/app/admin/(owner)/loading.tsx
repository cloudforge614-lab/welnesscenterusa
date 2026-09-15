import { Card, Skeleton } from "@/components/admin/ui";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-16" />
          </Card>
        ))}
      </div>
      <Card className="divide-y divide-line">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}
