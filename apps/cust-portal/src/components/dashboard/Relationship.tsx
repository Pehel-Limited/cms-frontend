'use client';

import Link from 'next/link';
import Glyph from '@/components/ui/Glyph';
import { formatCurrency } from '@/lib/format';
import {
  JOURNEY_STEPS,
  TERMINAL_STATUSES,
  appTitle,
  appUrgency,
  journeyStep,
} from '@/lib/dashboard-model';
import {
  LOAN_PURPOSE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type LoanApplication,
} from '@/services/api/application-service';
import type { CustomerSignal } from '@/services/api/ai-signals-service';
import { RetryNote, Zone, ZoneHeader, ZoneSkeleton } from './Zone';

const ACRONYMS: Record<string, string> = { Kyc: 'KYC', Aml: 'AML', Ai: 'AI', Otp: 'OTP' };

function signalLabel(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .split(' ')
    .map(w => ACRONYMS[w] ?? w)
    .join(' ');
}

export function ApplicationProgress({
  featured,
  activeCount,
  totalCount,
  updates,
  loading,
  failed,
  onRetry,
}: {
  featured: LoanApplication | null;
  activeCount: number;
  totalCount: number;
  updates: CustomerSignal[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const purposes = LOAN_PURPOSE_LABELS as Record<string, string>;

  return (
    <Zone labelledBy="zone-borrowing">
      <ZoneHeader
        id="zone-borrowing"
        title="Loans & applications"
        sub={
          loading || failed || totalCount === 0
            ? undefined
            : `${activeCount} in progress · ${totalCount} total`
        }
        href={totalCount > 0 ? '/portal/applications' : undefined}
      />
      {loading ? (
        <ZoneSkeleton rows={1} />
      ) : failed ? (
        <RetryNote text="We couldn't load your applications." onRetry={onRetry} />
      ) : !featured ? (
        <div className="px-5 pb-5 sm:px-6">
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Apply for a loan or credit product and follow every step from here.
          </p>
          <Link href="/portal/products" className="btn btn-primary btn-sm mt-3 min-h-[44px] w-full sm:w-auto">
            Explore borrowing
          </Link>
        </div>
      ) : (
        (() => {
          const step = journeyStep(featured.status);
          const active = !TERMINAL_STATUSES.has(featured.status);
          const needsYou = appUrgency(featured) > 0;
          return (
            <>
              <Link href={`/portal/applications/${featured.applicationId}`} className="block px-5 pb-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {appTitle(featured, purposes)}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[featured.status] || 'bg-slate-100 text-slate-700'}`}
                  >
                    {STATUS_LABELS[featured.status] || featured.status}
                  </span>
                  {needsYou && <span className="badge badge-primary">Needs you</span>}
                  {updates.length > 0 && (
                    <span className="dash-update-chip" title={updates.map(s => signalLabel(s.signalType)).join(', ')}>
                      {updates.length} update{updates.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  {featured.applicationNumber} · {formatCurrency(featured.approvedAmount ?? featured.requestedAmount)}
                  {featured.approvedMonthlyPayment
                    ? ` · ${formatCurrency(featured.approvedMonthlyPayment)}/mo`
                    : ''}
                </p>
                {active && step >= 0 && (
                  <div className="mt-3">
                    <div
                      className="flex items-center gap-1"
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={JOURNEY_STEPS.length}
                      aria-valuenow={step + 1}
                      aria-valuetext={`Step ${step + 1} of ${JOURNEY_STEPS.length}: ${JOURNEY_STEPS[step]}`}
                    >
                      {JOURNEY_STEPS.map((s, i) => (
                        <span
                          key={s}
                          className="h-1.5 flex-1 rounded-full"
                          style={{
                            background: i <= step ? 'var(--brand)' : 'var(--hairline-strong)',
                            opacity: i < step ? 0.55 : 1,
                          }}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      Step {step + 1} of {JOURNEY_STEPS.length} · {JOURNEY_STEPS[step]}
                    </p>
                  </div>
                )}
              </Link>
            </>
          );
        })()
      )}
    </Zone>
  );
}

export function RelationshipCard({ unread }: { unread: number }) {
  return (
    <Zone labelledBy="zone-relationship">
      <div className="flex items-center gap-3 px-5 pt-5 sm:px-6">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-on-soft)' }}
          aria-hidden="true"
        >
          <Glyph name="user" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="zone-relationship" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Your relationship manager
          </h2>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {unread > 0
              ? `${unread} unread message${unread === 1 ? '' : 's'}`
              : 'Here to help with your accounts and borrowing'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-5 sm:px-6">
        <Link href="/portal/messages" className="btn btn-primary btn-sm min-h-[44px]">
          <Glyph name="send" className="h-3.5 w-3.5" strokeWidth={2} />
          Message
        </Link>
        <Link href="/portal/documents" className="btn btn-secondary btn-sm min-h-[44px]">
          <Glyph name="doc" className="h-3.5 w-3.5" strokeWidth={2} />
          Documents
        </Link>
      </div>
    </Zone>
  );
}
