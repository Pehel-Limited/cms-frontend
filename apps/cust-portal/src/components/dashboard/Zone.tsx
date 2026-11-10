'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** One header pattern for every dashboard zone: title, one line of context, one way onward. */
export function ZoneHeader({
  id,
  title,
  sub,
  href,
  linkLabel = 'See all',
  aside,
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[13px] leading-5" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {href && (
          <Link href={href} className="sb-link">
            {linkLabel}
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}

export function Zone({
  labelledBy,
  className = '',
  children,
}: {
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className={`glass-panel overflow-hidden ${className}`}>
      {children}
    </section>
  );
}

export function ZoneSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-5 pb-5 sm:px-6" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 !rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RetryNote({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-2 px-5 pb-4 text-[13px] sm:px-6" style={{ color: 'var(--text-muted)' }}>
      <span>{text}</span>
      <button type="button" onClick={onRetry} className="sb-link">
        Try again
      </button>
    </p>
  );
}
