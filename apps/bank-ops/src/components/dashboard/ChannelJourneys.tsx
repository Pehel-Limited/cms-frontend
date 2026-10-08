'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import type { ChannelJourney } from '@/services/api/dashboard-service';

/* Sentiment tokens rather than fixed rgba literals: these sit on glass that
   changes ground between themes, and the tokens already carry a per-theme value
   instead of one compromise hue that has to work on both. */
const AMBER = 'var(--rm-warn)';
const GREEN = 'var(--rm-up)';

/* Guided-journey enums arrive as SNAKE_CODE. Sentence-case them for the pill,
   but keep real banking acronyms uppercase — "Pending KYC", not "Pending kyc".
   Only unambiguous acronyms belong here, so ordinary words stay lowercase. */
const ACRONYMS = new Set([
  'KYC',
  'AML',
  'CFT',
  'NRI',
  'GST',
  'MSME',
  'UPI',
  'RTGS',
  'NEFT',
  'IFSC',
  'CIBIL',
  'NBFC',
  'CGTMSE',
  'SME',
  'POS',
  'POI',
  'POA',
  'EMI',
  'LAF',
  'TAT',
  'LLP',
  'HUF',
  'OPC',
]);

function sentenceCase(raw: string | undefined): string {
  const words = (raw ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  return words
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (/^\d/.test(word)) return upper;
      const lower = word.toLowerCase();
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/* Liveness values say nothing about where the customer got to, so the stage
   carries the meaning; otherwise the journey status is the better label. */
const GENERIC_STATUS = new Set(['ACTIVE', 'IN_PROGRESS', 'INPROGRESS', 'OPEN', 'STARTED', 'ONGOING']);

function statusOf(journey: ChannelJourney): string {
  const status = (journey.status ?? '').trim();
  if (status.length === 0) return journey.currentStage;
  return GENERIC_STATUS.has(status.toUpperCase()) ? journey.currentStage || status : status;
}

/* Tint by what the state means to the RM, on the same brand + sentiment tokens
   the rest of the dashboard uses — an arbitrary sky for "draft" was the last
   off-palette hue left on the page. */
function pillTint(code: string): { bg: string; text: string } {
  const s = code.toUpperCase();
  const tint = (fg: string) => ({ bg: `color-mix(in srgb, ${fg} 14%, transparent)`, text: fg });
  if (s.includes('DRAFT')) return tint('var(--rm-brand)');
  if (s.includes('PAUSED') || s.includes('STALLED')) return tint('var(--rm-warn)');
  if (s.includes('ABANDON') || s.includes('EXPIRED') || s.includes('CLOSED'))
    return tint('var(--rm-down)');
  return { bg: 'var(--rm-input)', text: 'var(--rm-text-secondary)' };
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function daysAgo(days: number): string {
  if (days <= 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * A figure only counts as stated if it is a real number: a finite positive
 * number, or a bare numeric string. Grouping separators, spacing and a leading
 * currency symbol carry no extra value, so they are stripped first; anything
 * like "5-10 lakh" or "undecided" fails the test and gets an em dash.
 */
function asPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/^[₹$£€]/, '')
    .replace(/[,\s_]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * ChannelJourney has no amount field, so the only honest number for this column
 * is one the customer actually told us: scan the journey's facts for a key
 * containing "amount" whose value is a positive number, and format that. No such
 * fact means an em dash — never an estimate, never a product-default figure.
 */
function statedAmount(journey: ChannelJourney): string {
  for (const fact of journey.facts ?? []) {
    if (!/amount/i.test(fact.factKey)) continue;
    const value = asPositiveNumber(fact.value);
    if (value !== null) return formatCurrency(value);
  }
  return '—';
}

// Facts are free-form keys set by the guided journey, so they arrive as camelCase
// identifiers and machine enums. Show them the way an RM would read them.
const MONEY_KEY = /amount|cost|price|deposit|income|turnover|revenue/i;

function factLabel(key: string): string {
  const spaced = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function factValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return MONEY_KEY.test(key) ? formatCurrency(value) : value.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(value)) {
    return value.toLowerCase().replace(/_/g, ' ');
  }
  return String(value);
}

interface Props {
  journeys: ChannelJourney[];
  /** Shown on the oversight view, where a row needs to say whose customer it is. */
  rmNameById?: Map<string, string>;
  title?: string;
  onSelectRm?: (rmUserId: string) => void;
}

const HEAD_CLASS = 'min-w-0 truncate px-2 py-2.5 text-xs font-medium';

export default function ChannelJourneys({ journeys, rmNameById, title = 'With the customer', onSelectRm }: Props) {
  const [stalledOnly, setStalledOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      journeys
        .filter(j => (stalledOnly ? j.daysStalled >= 7 : true))
        // Longest silence first: the deals most likely to be lost are the ones nobody
        // has heard from for longest.
        .sort((a, b) => b.daysStalled - a.daysStalled),
    [journeys, stalledOnly]
  );

  if (journeys.length === 0) return null;

  const notSubmitted = journeys.filter(j => !j.applicationId).length;

  const toggle = (journeyId: string) => setExpanded(open => (open === journeyId ? null : journeyId));

  return (
    <section className="rm-panel">
      <div className="rm-panel-head flex-wrap">
        <div className="min-w-0">
          <h2 className="rm-title">{title}</h2>
          <p className="rm-sub">
            <span className="num">{journeys.length}</span> in progress on the customer side ·{' '}
            <span className="num">{notSubmitted}</span> never reached submission, so they are not in your pipeline
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStalledOnly(value => !value)}
          aria-pressed={stalledOnly}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
          style={
            stalledOnly
              ? { backgroundColor: 'color-mix(in srgb, var(--rm-warn) 16%, transparent)', color: AMBER }
              : { backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }
          }
        >
          Quiet for <span className="num">7+</span> days{stalledOnly ? ' only' : ''}
        </button>
      </div>

      <div className="rm-body">
        <p className="text-sm mb-4" style={{ color: 'var(--rm-text-muted)' }}>
          These are the ones you can still help. Nothing here has been submitted, so the figures below are only
          what the customer has told us so far — an em dash means we were never given one.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm py-6" style={{ color: 'var(--rm-text-muted)' }}>
            Nothing quiet for a week or more right now.
          </p>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="rm-table w-full table-fixed border-collapse text-left">
              <thead>
                <tr>
                  <th scope="col" className={`${HEAD_CLASS} w-[36%]`}>
                    Customer
                  </th>
                  {rows.some(r => r.productName) && (
                    <th scope="col" className={HEAD_CLASS}>
                      Product
                    </th>
                  )}
                  <th scope="col" className={`${HEAD_CLASS} w-[20%] text-right`}>
                    Amount
                  </th>
                  <th scope="col" className={`${HEAD_CLASS} w-[22%]`}>
                    Customer status
                  </th>
                  <th scope="col" className={`${HEAD_CLASS} w-[14%]`}>
                    Last activity
                  </th>
                  <th scope="col" className="w-10 px-2 py-2.5">
                    <span className="sr-only">What the customer has told us</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(journey => {
                  const isOpen = expanded === journey.journeyId;
                  const rmName = journey.rmUserId ? rmNameById?.get(journey.rmUserId) : undefined;
                  const status = statusOf(journey);
                  const tint = pillTint(status);
                  const quiet = journey.daysStalled >= 7;
                  const detailId = `journey-facts-${journey.journeyId}`;

                  return (
                    <Fragment key={journey.journeyId}>
                      <tr className="cursor-pointer" onClick={() => toggle(journey.journeyId)}>
                        <td className="px-2 py-3 align-top">
                          {/* Real button = keyboard-operable row; the click on the rest of the
                              row is a mouse convenience, so stop the button bubbling onto it. */}
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              toggle(journey.journeyId);
                            }}
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            className="flex w-full items-start gap-2.5 text-left transition-opacity hover:opacity-90"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: 'var(--rm-input)',
                                color: 'var(--rm-text-secondary)',
                                border: '1px solid var(--rm-hairline-strong)',
                              }}
                            >
                              {initials(journey.customerName)}
                            </span>
                            <span className="min-w-0">
                              {/* Name and product are words, so they carry the serif; the
                                  customer number under them stays sans tabular. */}
                              <span
                                className="serif block truncate text-sm font-medium"
                                style={{ color: 'var(--rm-text)' }}
                              >
                                {journey.customerName || 'Unnamed customer'}
                              </span>
                              <span className="block truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                                <span className="num">
                                  {journey.customerNumber || sentenceCase(journey.customerType)}
                                </span>
                                {rmName && onSelectRm ? ` · ${rmName}` : null}
                              </span>
                            </span>
                          </button>
                        </td>

                        {rows.some(r => r.productName) && (
                          <td className="px-2 py-3 align-top text-sm">
                            <span
                              className="serif block max-w-[10rem] truncate"
                              style={{
                                color: journey.productName ? 'var(--rm-text-secondary)' : 'var(--rm-text-muted)',
                              }}
                            >
                              {journey.productName || '—'}
                            </span>
                          </td>
                        )}

                        <td
                          className="num px-2 py-3 align-top text-right text-sm"
                          style={{ color: 'var(--rm-text)' }}
                          title="Only amounts the customer stated themselves"
                        >
                          {statedAmount(journey)}
                        </td>

                        <td className="px-2 py-3 align-top">
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ backgroundColor: tint.bg, color: tint.text }}
                          >
                            {sentenceCase(status)}
                          </span>
                        </td>

                        <td
                          className="num whitespace-nowrap px-2 py-3 align-top text-sm"
                          style={{ color: quiet ? AMBER : GREEN }}
                        >
                          {daysAgo(journey.daysStalled)}
                        </td>

                        <td className="px-2 py-3 align-top text-right">
                          <svg
                            aria-hidden="true"
                            className="inline-block h-4 w-4 transition-transform duration-200"
                            style={{
                              color: 'var(--rm-text-muted)',
                              transform: isOpen ? 'rotate(90deg)' : 'none',
                            }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>

                      {/* Facts disclosure: full-width row under its journey. */}
                      {isOpen && (
                        <tr id={detailId}>
                          <td colSpan={6} className="px-2 pb-4 align-top">
                            <div className="rm-rule animate-fade-in pt-3.5">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                                  <span className="num">{journey.factCount}</span> facts captured
                                </p>
                                <Link
                                  href={`/dashboard/customers/${journey.customerId}`}
                                  className="text-sm font-medium inline-flex items-center gap-1 hover:underline"
                                  style={{ color: 'var(--rm-accent)' }}
                                >
                                  Open customer
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              </div>

                              {journey.pausedReason && (
                                <p className="mt-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                  Paused: {journey.pausedReason}
                                </p>
                              )}

                              {journey.facts && journey.facts.length > 0 ? (
                                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:max-w-[40rem]">
                                  {journey.facts.map((fact, index) => (
                                    <div key={`${fact.factKey}-${index}`} className="flex gap-3 text-sm min-w-0">
                                      <dt className="shrink-0" style={{ color: 'var(--rm-text-muted)' }}>
                                        {factLabel(fact.factKey)}
                                      </dt>
                                      <dd
                                        className="ml-auto font-medium text-right truncate"
                                        style={{ color: 'var(--rm-text)' }}
                                        title={factValue(fact.factKey, fact.value)}
                                      >
                                        {factValue(fact.factKey, fact.value)}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                  Nothing confirmed yet — the customer stopped before answering.
                                </p>
                              )}

                              {journey.eligibilityChecks > 0 && (
                                <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                                  They ran <span className="num">{journey.eligibilityChecks}</span> eligibility check
                                  {journey.eligibilityChecks === 1 ? '' : 's'} — the reason codes are on the customer
                                  record.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
