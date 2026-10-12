'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { MissingItem, WorklistItem } from '@/services/api/dashboard-service';
import {
  RiskTier,
  blockerLabel,
  byUrgency,
  humanise,
  isRmAction,
  nextActionLabel,
  riskOf,
} from '@/lib/application-buckets';

/* The band an RM acts from: what to press, what is missing, what is slipping.
   All three read the same `WorklistItem[]` the pipeline board and the queue table
   use, so a count here is never a different number from a count there.

   Nothing on it is a forecast. The reference drew a "key upcoming milestones"
   panel, but `credit.loan_application` exposes no future date the API serves —
   `decision_due_date` and `offer_valid_until` are not selected by
   `v_rm_worklist` — so the middle panel lists the oldest *recorded* waits
   instead, and its date tile says which case it came from. */

interface Tone {
  bg: string;
  fg: string;
  label: string;
}

const TIER_TONE: Record<RiskTier, Tone> = {
  high: { bg: 'color-mix(in srgb, var(--rm-down) 15%, transparent)', fg: 'var(--rm-down)', label: 'High' },
  medium: { bg: 'var(--rm-warn-soft)', fg: 'var(--rm-warn)', label: 'Medium' },
  low: { bg: 'rgba(127,127,127,0.14)', fg: 'var(--rm-text-secondary)', label: 'Low' },
};

const NEUTRAL: Tone = { bg: 'rgba(127,127,127,0.14)', fg: 'var(--rm-text)', label: '' };

function Row({
  item,
  chip,
  chipTone,
  detail,
  action,
}: {
  item: WorklistItem;
  chip: string;
  chipTone: Tone;
  /** What the row is about: the next step, or the reason it is flagged. */
  detail: React.ReactNode;
  /** Overrides the default "Open" link when the row carries a real verb. */
  action?: React.ReactNode;
}) {
  return (
    <article
      className="rounded-2xl p-3.5"
      style={{ backgroundColor: 'var(--rm-card)', boxShadow: 'inset 0 0 0 1px var(--rm-hairline)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--rm-text)' }} title={item.customerName}>
            {item.customerName || '—'}
          </p>
          <p className="num mt-0.5 truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
            {formatCurrency(item.requestedAmount)} · {item.productName || humanise(item.status)}
          </p>
        </div>
        <span
          className="num shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
          style={{ backgroundColor: chipTone.bg, color: chipTone.fg }}
        >
          {chip}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--rm-accent)' }}>
          {detail}
        </span>
        {action ?? (
          <Link
            href={`/dashboard/applications/${item.applicationId}`}
            aria-label={`Open ${item.customerName || 'this application'}`}
            className="shrink-0 text-xs font-semibold hover:underline"
            style={{ color: 'var(--rm-text-secondary)' }}
          >
            Open
          </Link>
        )}
      </div>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-6 pb-10 pt-2 text-center">
      <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {text}
      </p>
    </div>
  );
}

/* `a/b d` only while the row still fits inside its window; past it without a
   recorded breach, the chip says how long it has actually been idle. */
function chipFor(item: WorklistItem): { chip: string; tone: Tone } {
  const risk = riskOf(item);
  if (!risk) return { chip: `${item.daysInCurrentStage}d`, tone: NEUTRAL };
  if (risk.over > 0) return { chip: `+${risk.over}d over`, tone: TIER_TONE.high };
  if (risk.limit === null) return { chip: `${risk.elapsed}d idle`, tone: TIER_TONE.low };
  if (risk.elapsed > risk.limit) return { chip: `${risk.elapsed}d idle`, tone: TIER_TONE.medium };
  const chip = `${risk.elapsed}/${risk.limit}d`;
  return { chip, tone: risk.tier === 'medium' ? TIER_TONE.medium : TIER_TONE.low };
}

/* ─────────────────────────── Action required ─────────────────────────── */

/**
 * Everything whose next move is a step the RM can take. Items waiting on an
 * underwriter or the customer are left out — the board and the "waiting on the
 * customer" card already own them, and one panel should not claim both "you must
 * act" and "someone else must".
 */
export function ActionQueue({
  items,
  onCompleteKyc,
  kycLoadingId,
  limit = 4,
}: {
  items: WorklistItem[];
  onCompleteKyc: (applicationId: string) => void;
  kycLoadingId: string | null;
  limit?: number;
}) {
  const queue = byUrgency(items.filter(isRmAction));
  const visible = queue.slice(0, limit);
  const hidden = queue.length - visible.length;

  return (
    <section className="rm-panel">
      <header className="rm-panel-head">
        <div className="min-w-0">
          <h2 className="rm-title">Action required</h2>
          <p className="rm-sub">
            <span className="num">{queue.length}</span> waiting on a step you can take
          </p>
        </div>
      </header>

      {visible.length === 0 ? (
        <Empty text="Nothing is waiting on you right now." />
      ) : (
        <div className="rm-body space-y-2.5">
          {visible.map(item => {
            const { chip, tone } = chipFor(item);
            const kyc = item.status === 'PENDING_KYC' || item.nextAction === 'COMPLETE_KYC';
            const busy = kycLoadingId === item.applicationId;
            return (
              <Row
                key={item.applicationId}
                item={item}
                chip={chip}
                chipTone={tone}
                detail={nextActionLabel(item)}
                action={
                  kyc ? (
                    <button
                      type="button"
                      onClick={() => onCompleteKyc(item.applicationId)}
                      disabled={busy}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: 'var(--rm-accent)', color: 'var(--rm-bg)' }}
                    >
                      {busy ? 'Working…' : 'Complete KYC'}
                    </button>
                  ) : undefined
                }
              />
            );
          })}
          {hidden > 0 && (
            <p className="pt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              <span className="num">{hidden}</span> more below in the queue.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ────────────────────── Outstanding requirements ─────────────────────── */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/**
 * `v_dashboard_missing_items` returns, per missing item, a count, the submission
 * date of the oldest case waiting on it and up to ten example application numbers.
 * `MISSING_KYC` and friends are the view's own four categories, so nothing here
 * groups or renames what the bank did not.
 */
export function RequirementWaits({ items, limit = 4 }: { items: MissingItem[]; limit?: number }) {
  const rows = items.filter(i => i.applicationCount > 0).sort((a, b) => b.applicationCount - a.applicationCount);
  const visible = rows.slice(0, limit);
  const hidden = rows.length - visible.length;
  const total = rows.reduce((s, i) => s + i.applicationCount, 0);

  return (
    <section className="rm-panel">
      <header className="rm-panel-head">
        <div className="min-w-0">
          <h2 className="rm-title">Outstanding requirements</h2>
          <p className="rm-sub">
            {rows.length === 0
              ? 'Nothing is missing'
              : `${total} application${total === 1 ? '' : 's'} short of something`}
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <Empty text="Every application in your book has what it needs." />
      ) : (
        <div className="rm-body space-y-2.5">
          {visible.map(item => {
            const oldest = item.oldestCaseDate ? new Date(item.oldestCaseDate) : null;
            return (
              <div
                key={item.itemCategory}
                className="flex items-center gap-3 rounded-2xl p-3"
                style={{ backgroundColor: 'var(--rm-card)', boxShadow: 'inset 0 0 0 1px var(--rm-hairline)' }}
              >
                <span
                  className="flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5"
                  style={{ backgroundColor: 'var(--rm-brand-soft)', color: 'var(--rm-brand-on-soft)' }}
                  title={oldest ? `Oldest case submitted ${oldest.toLocaleDateString()}` : undefined}
                >
                  <span className="text-[10px] font-semibold leading-none">
                    {oldest ? MONTHS[oldest.getMonth()] : '—'}
                  </span>
                  <span className="num mt-0.5 text-base font-bold leading-none">
                    {oldest ? String(oldest.getDate()).padStart(2, '0') : ''}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                    {humanise(item.itemCategory).replace(/^Missing /, '')}
                  </p>
                  <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                    {item.oldestCaseDate
                      ? `Waiting ${daysSince(item.oldestCaseDate)} days · ${item.sampleApplicationNumbers?.[0] ?? ''}`
                      : 'Awaiting action'}
                  </p>
                </div>

                <span
                  className="num shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: NEUTRAL.bg, color: NEUTRAL.fg }}
                >
                  {item.applicationCount}
                </span>
              </div>
            );
          })}
          {hidden > 0 && (
            <p className="pt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              <span className="num">{hidden}</span> more requirement{hidden === 1 ? '' : 's'} recorded by the bank.
            </p>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <footer className="rm-foot">
          Date marks the oldest case waiting on that item.{' '}
          <Link
            href="/dashboard/documents"
            className="font-medium hover:underline"
            style={{ color: 'var(--rm-accent)' }}
          >
            Documents
          </Link>
        </footer>
      )}
    </section>
  );
}

/* ─────────────────────────────── At risk ─────────────────────────────── */

/**
 * The tier is derived, never supplied: high is the worklist view's own
 * `sla_breach_days`, medium is the same documented window with two days or less
 * left on it. A status the view gives no window for can only ever read low.
 */
export function RiskWatch({ items, limit = 4 }: { items: WorklistItem[]; limit?: number }) {
  const scored = byUrgency(items).flatMap(item => {
    const risk = riskOf(item);
    return risk && risk.tier !== 'low' ? [{ item, risk, tone: TIER_TONE[risk.tier] }] : [];
  });
  const visible = scored.slice(0, limit);
  const hidden = scored.length - visible.length;
  const high = scored.filter(s => s.risk.tier === 'high').length;

  return (
    <section className="rm-panel">
      <header className="rm-panel-head">
        <div className="min-w-0">
          <h2 className="rm-title">At-risk applications</h2>
          <p className="rm-sub">
            {scored.length === 0
              ? 'Nothing outside its window'
              : `${high} past a stage window · ${scored.length - high} nearly out of one`}
          </p>
        </div>
      </header>

      {visible.length === 0 ? (
        <Empty text="Every live application is inside the time its stage allows." />
      ) : (
        <div className="rm-body space-y-2.5">
          {visible.map(({ item, risk, tone }) => (
            <Row
              key={item.applicationId}
              item={item}
              chip={risk.over > 0 ? `+${risk.over}d over` : risk.elapsed > (risk.limit ?? Infinity) ? `${risk.elapsed}d idle` : `${risk.elapsed}/${risk.limit}d`}
              chipTone={tone}
              detail={
                <>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none"
                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                  >
                    {tone.label}
                  </span>
                  <span className="truncate">{blockerLabel(item) ?? nextActionLabel(item)}</span>
                </>
              }
            />
          ))}
          {hidden > 0 && (
            <p className="pt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              <span className="num">{hidden}</span> more further down the same ordering.
            </p>
          )}
        </div>
      )}

      <footer className="rm-foot">
        High is idle past the window its status allows; medium has two days or less left on it.{' '}
        <Link
          href="/dashboard/applications"
          className="font-medium hover:underline"
          style={{ color: 'var(--rm-accent)' }}
        >
          Open the queue
        </Link>
      </footer>
    </section>
  );
}
