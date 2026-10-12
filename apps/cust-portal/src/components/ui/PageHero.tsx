'use client';

import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────────
 * Shared editorial sections.
 *
 * The overview page reads as composed rather than merely themed because each
 * section has a deliberate shape: a serif title with pill actions, a row of
 * ringed icon actions. Those shapes live here so every page gets the same
 * composition instead of re-deriving it from raw Tailwind classes.
 *
 * Headings take the display serif; every numeral stays in Inter tabular.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Page opener: serif title, one supporting line, the page's actions as pills on
 * the right, and an optional slot for counts or data-source chips. Replaces both
 * the bare `text-2xl font-bold` headings and the old `page-header` row.
 */
export function PageHero({
  title,
  subtitle,
  actions,
  meta,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small chips under the subtitle — counts, windows, data-source notes. */
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="glass-panel px-6 py-6 sm:px-8 sm:py-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1
            className="serif text-[28px] font-medium leading-tight tracking-tight sm:text-[32px]"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Ringed icon actions — the reference's "Show PIN / Card Details / Freeze Card"
 * row. Each item is a link or a button; pass `onClick` for the latter.
 */
export function RingActions({
  items,
  label,
}: {
  items: {
    key: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    active?: boolean;
  }[];
  label?: string;
}) {
  const body = items.map(item => {
    const inner = (
      <>
        <span className="ghost-ring !h-12 !w-12 [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
        <span className="text-center text-xs font-medium">{item.label}</span>
      </>
    );
    const cls =
      'group flex flex-col items-center gap-2 rounded-2xl px-2 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]';

    if (item.href) {
      return (
        <Link
          key={item.key}
          href={item.href}
          className={cls}
          style={{ color: 'var(--text-secondary)' }}
        >
          {inner}
        </Link>
      );
    }

    return (
      <button
        key={item.key}
        type="button"
        onClick={item.onClick}
        disabled={item.disabled}
        aria-pressed={item.active}
        className={`${cls} disabled:opacity-40`}
        style={{ color: item.active ? 'var(--brand-on-soft)' : 'var(--text-secondary)' }}
      >
        {inner}
      </button>
    );
  });

  return (
    <nav aria-label={label} className="glass-panel">
      <div className="grid grid-cols-3 gap-1 p-3 sm:grid-cols-6">{body}</div>
    </nav>
  );
}
