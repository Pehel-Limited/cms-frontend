'use client';

import { Fragment, useMemo } from 'react';
import Link from 'next/link';
import { compactCurrency } from '@/lib/format';
import type { PipelineStage } from '@/services/api/dashboard-service';

/* SNAKE_CASE enums never reach an RM — the stage reads as a sentence, not a code. */
function humanise(value: string): string {
  const spaced = value.toLowerCase().replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* This RM's pipeline returns eleven stages and the previous eight-hue ramp
   wrapped, so stage 1 and stage 9 rendered the same colour and read as one
   phase. Hue was never carrying information here anyway — the node label and
   count do — so the ramp is gone and only the selected stage is picked out. */

const PENDING = ['kycPendingCount', 'amlPendingCount', 'docsPendingCount', 'creditCheckPendingCount'] as const;

const PENDING_LABEL: Record<(typeof PENDING)[number], string> = {
  kycPendingCount: 'KYC',
  amlPendingCount: 'AML',
  docsPendingCount: 'Docs',
  creditCheckPendingCount: 'Credit',
};

/* A duration we don't have stays an em dash — never a rounded-up guess. */
function days(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—';
  return `${Math.round(value)}d`;
}

interface Props {
  stages: PipelineStage[];
  /** Currently selected stage (for click-to-filter); null/undefined = none. */
  selectedStage?: string | null;
  /** Called with the toggled stage, or null to clear. Omit to keep the chart static. */
  onStageSelect?: (stage: string | null) => void;
}

export default function PipelineOverview({ stages, selectedStage = null, onStageSelect }: Props) {
  const rows = useMemo(
    () =>
      stages
        .filter(s => s?.stage)
        .map(s => ({
          stage: s.stage,
          name: humanise(s.stage),
          count: s.applicationCount ?? 0,
          value: s.totalValue ?? 0,
          avg: s.avgDaysInStage ?? null,
          p90: s.p90DaysInStage ?? null,
        })),
    [stages]
  );

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const stageCount = rows.filter(r => r.count > 0).length;

  /* What is parked with a third party, summed across the whole funnel. */
  const pendingTotals = useMemo(
    () =>
      PENDING.map(key => ({
        key,
        label: PENDING_LABEL[key],
        n: stages.reduce((sum, s) => sum + (s?.[key] ?? 0), 0),
      })).filter(p => p.n > 0),
    [stages]
  );

  /* Widest gap between the slowest 10% and the typical deal = the real bottleneck. */
  const bottleneck = useMemo(() => {
    const scored = rows
      .map(r => ({ ...r, avgDays: r.avg ?? 0, p90Days: r.p90 ?? 0 }))
      .filter(r => r.count > 0 && r.avgDays > 0 && r.p90Days > 0)
      .sort((a, b) => b.p90Days - b.avgDays - (a.p90Days - a.avgDays));
    return scored[0];
  }, [rows]);

  /* Empty / loading: while the pipeline call has not resolved there is nothing
     honest to show, so the panel stays out of the layout instead of flashing. */
  if (totalCount === 0) return null;

  return (
    <section className="rm-panel">
      <div className="rm-panel-head">
        <div className="min-w-0">
          <h2 className="rm-title">Pipeline overview</h2>
          <p className="rm-sub num">
            {totalCount} applications moving through {stageCount} stages
          </p>
        </div>
        <Link
          href="/dashboard/applications"
          className="serif shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
        >
          View pipeline
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* horizontal stepper: 2-column grid on mobile, scrollable rail from sm up */}
      <div className="rm-body rm-body-center">
        <ol className="grid grid-cols-2 gap-3 stagger-children sm:flex sm:flex-nowrap sm:items-stretch sm:gap-0 sm:overflow-x-auto sm:pb-1">
          {rows.map((r, i) => {
            const active = selectedStage === r.stage;
            const dimmed = selectedStage !== null && !active;
            return (
              <Fragment key={r.stage}>
                {i > 0 && (
                  <li
                    aria-hidden="true"
                    className="hidden sm:flex shrink-0 self-start items-center h-[68px]"
                    style={{ color: 'var(--rm-text-muted)' }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </li>
                )}
                <li className="min-w-0 sm:min-w-[92px] sm:flex-1 sm:shrink">
                  <button
                    type="button"
                    disabled={!onStageSelect}
                    onClick={() => onStageSelect?.(selectedStage === r.stage ? null : r.stage)}
                    aria-pressed={active}
                    title={`${r.name}: ${r.count} applications${onStageSelect ? ' — click to filter' : ''}`}
                    className={`w-full flex flex-col items-center justify-center text-center rounded-2xl px-2.5 py-3 transition-all duration-200 ${
                      onStageSelect ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'
                    }`}
                    style={{
                      backgroundColor: active ? 'var(--rm-brand-soft)' : 'transparent',
                      boxShadow: active ? '0 0 0 2px var(--rm-brand)' : 'none',
                      opacity: dimmed ? 0.5 : 1,
                    }}
                  >
                    <span
                      className="num grid h-11 w-11 place-items-center rounded-full text-[15px] font-semibold"
                      style={{
                        backgroundColor: active ? 'var(--rm-brand)' : 'var(--rm-brand-soft)',
                        color: active ? '#fff' : 'var(--rm-text)',
                      }}
                    >
                      {r.count.toLocaleString()}
                    </span>
                    <span className="serif mt-2 text-[15px] leading-tight" style={{ color: 'var(--rm-text)' }}>
                      {r.name}
                    </span>
                    <span className="num mt-1 text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                      {r.value > 0 ? compactCurrency(r.value) : '—'}
                    </span>
                    {/* "Idle", not "in stage": the view computes both from
                        CURRENT_DATE - updated_at, and a write to any column
                        resets that clock. There is no stage-entry timestamp. */}
                    <span
                      className="num mt-1 text-xs leading-5"
                      style={{ color: 'var(--rm-text-muted)' }}
                      title="Average days since the application was last updated. This is not time spent in this stage."
                    >
                      idle avg {days(r.avg)}
                    </span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>

      {(pendingTotals.length > 0 || bottleneck) && (
        <div className="rm-rule px-6 sm:px-7 py-4 space-y-2">
          {pendingTotals.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                Waiting on
              </span>
              {pendingTotals.map(p => (
                <span
                  key={p.key}
                  className="num rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--rm-brand-soft)', color: 'var(--rm-brand-on-soft)' }}
                >
                  {p.label} {p.n}
                </span>
              ))}
            </div>
          )}
          {bottleneck && bottleneck.p90Days >= bottleneck.avgDays * 2 && (
            <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              <span className="serif" style={{ color: 'var(--rm-warn)' }}>
                {bottleneck.name}
              </span>{' '}
              has the longest idle tail — 10% of its applications have gone untouched for <span className="num">{bottleneck.p90Days.toFixed(0)}</span> days
              or longer, against a <span className="num">{bottleneck.avgDays.toFixed(0)}</span>-day average.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
