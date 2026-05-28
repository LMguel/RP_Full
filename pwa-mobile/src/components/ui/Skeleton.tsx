import React, { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
  rounded?: string;
  lines?: number;
}

export function Skeleton({ width, height, rounded = 'rounded-lg', className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`bg-slate-700 animate-pulse ${rounded} ${className}`}
      style={{ width, height }}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="16px" width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton width="40px" height="40px" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="14px" width="60%" />
          <Skeleton height="12px" width="40%" />
        </div>
      </div>
      <Skeleton height="12px" />
      <Skeleton height="12px" width="80%" />
    </div>
  );
}

export default Skeleton;
