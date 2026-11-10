'use client';

import type { ReactNode } from 'react';

/**
 * The header every loan screen opens with. It is the dashboard's own `sb-hero` (same gradient,
 * radius, chips and type scale as the balance card), so moving from the overview into borrowing
 * reads as one product rather than a second app with its own look.
 */
export function LoanHero({
  eyebrow,
  title,
  titleId,
  sub,
  chips,
  actions,
  children,
  className = '',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId?: string;
  sub?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={titleId} className={`sb-hero ${className}`}>
      <div className="relative z-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && <p className="text-[13px] font-medium text-white/75">{eyebrow}</p>}
            <h1
              id={titleId}
              className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]"
            >
              {title}
            </h1>
            {sub && <p className="mt-1.5 max-w-xl text-[14px] leading-6 text-white/75">{sub}</p>}
            {chips && <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">{chips}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** White pill on the hero — the hero's primary action, matching the dashboard's on-hero verbs. */
export const HERO_PRIMARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#5e1f5b] shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-white disabled:opacity-60';

/** Translucent pill on the hero — a secondary action. */
export const HERO_SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-white disabled:opacity-60';
