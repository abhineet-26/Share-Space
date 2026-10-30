import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded bg-[var(--border-color)]/60 ${className}`}
    aria-hidden="true"
  />
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[8px] p-4 space-y-3">
    <div className="flex gap-4">
      <Skeleton className="w-24 h-24 rounded-[6px] shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
    <div className="pt-2 border-t border-[var(--border-color)] flex justify-between items-center">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-24 rounded-[6px]" />
    </div>
  </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
  <tr className="border-b border-[var(--border-color)] animate-pulse">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="py-3.5 px-4">
        <Skeleton className={`h-3 ${i === 0 ? 'w-3/4' : 'w-1/2'}`} />
      </td>
    ))}
  </tr>
);

export const DetailPageSkeleton: React.FC = () => (
  <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
    <div className="border-b border-[var(--border-color)] pb-4 space-y-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <Skeleton className="h-64 rounded-[8px]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-[8px]" />
        <Skeleton className="h-32 rounded-[8px]" />
      </div>
    </div>
  </div>
);
