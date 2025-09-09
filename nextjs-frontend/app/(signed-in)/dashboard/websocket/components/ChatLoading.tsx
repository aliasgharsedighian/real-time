"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Left message */}
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <Skeleton className="h-8 w-8 rounded-full" />
        {/* Message bubble */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32 rounded-2xl" />
          <Skeleton className="h-4 w-24 rounded-2xl" />
        </div>
      </div>

      {/* Right message */}
      <div className="flex items-start gap-2 justify-end">
        {/* Message bubble */}
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-4 w-40 rounded-2xl" />
          <Skeleton className="h-4 w-48 rounded-2xl" />
          <Skeleton className="h-4 w-64 rounded-2xl" />
          <Skeleton className="h-4 w-32 rounded-2xl" />
          <Skeleton className="h-4 w-28 rounded-2xl" />
        </div>
        {/* Avatar */}
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Left message */}
      <div className="flex items-start gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28 rounded-2xl" />
          <Skeleton className="h-4 w-48 rounded-2xl" />
          <Skeleton className="h-4 w-32 rounded-2xl" />
          <Skeleton className="h-4 w-28 rounded-2xl" />
        </div>
      </div>

      {/* Right message */}
      <div className="flex items-start gap-2 justify-end">
        {/* Message bubble */}
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-4 w-40 rounded-2xl" />
          <Skeleton className="h-4 w-48 rounded-2xl" />
          <Skeleton className="h-4 w-64 rounded-2xl" />
          <Skeleton className="h-4 w-32 rounded-2xl" />
          <Skeleton className="h-4 w-28 rounded-2xl" />
        </div>
        {/* Avatar */}
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Left message */}
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <Skeleton className="h-8 w-8 rounded-full" />
        {/* Message bubble */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32 rounded-2xl" />
          <Skeleton className="h-4 w-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
