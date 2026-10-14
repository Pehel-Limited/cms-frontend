'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import {
  aiCreditJourneyService,
  DEFAULT_INTENT_OPTIONS,
  BORROWER_SEGMENT_OPTIONS,
  ASSET_CATEGORY_OPTIONS,
  requiresBorrowerSegment,
  requiresAssetCategory,
  type CreditJourney,
  type CreditNeedFacts,
  type IntentOption,
  type SuitabilityStage,
  type SuitabilityGroupQuestion,
} from '@/services/api/ai-credit-journey-service';

/* ─── helpers ────────────────────────────────────────────────── */

function formatFactValue(key: string, value: unknown, facts: CreditNeedFacts): string {
  if (value === null || value === undefined || value === '' || value === 'UNKNOWN' || value === 'NOT_APPLICABLE') {
    return '—';
  }
  if (key === 'estimatedCost') {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return '—';
    return formatCurrency(n, facts.currency || 'EUR');
  }
  if (key === 'borrowerSegment') {
    return BORROWER_SEGMENT_OPTIONS.find(o => o.value === value)?.label ?? String(value).replace(/_/g, ' ');
  }
  if (key === 'assetCategory') {
    return ASSET_CATEGORY_OPTIONS.find(o => o.value === value)?.label ?? String(value).replace(/_/g, ' ');
  }
  return String(value).replace(/_/g, ' ');
}

const FACT_LABELS: Record<string, string> = {
  purpose: 'Purpose',
  assetCondition: 'Condition',
  estimatedCost: 'Estimated amount',
  currency: 'Currency',
  targetDate: 'Target date',
  borrowerSegment: 'Borrower type',
  assetCategory: 'Asset / equipment type',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ─── Review / confirmation card ────────────────────────────── */

function ReviewCard({
  facts,
  status,
  onConfirm,
  onRequestRevision,
  busy,
}: {
  facts: CreditNeedFacts;
  status: string;
  onConfirm: () => void;
  onRequestRevision: (updates: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [purpose, setPurpose] = useState(facts.purpose || '');
  const [estimatedCost, setEstimatedCost] = useState(
    facts.estimatedCost != null ? String(facts.estimatedCost) : ''
  );
  const [currency, setCurrency] = useState(facts.currency || 'EUR');
  const [targetDate, setTargetDate] = useState(facts.targetDate || '');
  const [borrowerSegment, setBorrowerSegment] = useState(facts.borrowerSegment || 'UNKNOWN');
  const [assetCategory, setAssetCategory] = useState(facts.assetCategory || 'NOT_APPLICABLE');

  const isPresented = status === 'PRESENTED';
  const isConfirmed = status === 'CONFIRMED';
  const showBorrowerSegment = requiresBorrowerSegment(facts.purpose);
  const showAssetCategory = requiresAssetCategory(facts.purpose);

  function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    onRequestRevision({
      purpose,
      estimatedCost: estimatedCost === '' ? null : parseFloat(estimatedCost),
      currency,
      targetDate: targetDate || null,
      borrowerSegment,
      assetCategory,
    });
    setEditing(false);
  }

  return (
    <div
      className="panel p-5"
      style={
        isConfirmed
          ? { borderColor: 'rgba(16,185,129,0.45)', boxShadow: 'none' }
          : undefined
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="panel-title">
          {isConfirmed ? 'Confirmed credit need' : 'Review your credit need'}
        </h2>
        {isConfirmed && (
          <span className="badge badge-success shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirmed
          </span>
        )}
        {facts.needsClarification && !isConfirmed && (
          <span className="badge badge-warning shrink-0">Needs more info</span>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              'purpose',
              'assetCondition',
              'estimatedCost',
              'targetDate',
              ...(showBorrowerSegment ? (['borrowerSegment'] as const) : []),
              ...(showAssetCategory ? (['assetCategory'] as const) : []),
            ] as const
          ).map(key => (
            <div key={key}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {FACT_LABELS[key]}
              </p>
              <p className="mt-0.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatFactValue(key, (facts as unknown as Record<string, unknown>)[key], facts)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submitRevision} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="review-purpose">
              Purpose code
            </label>
            <input
              id="review-purpose"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-amount">
              Estimated amount
            </label>
            <input
              id="review-amount"
              type="number"
              value={estimatedCost}
              onChange={e => setEstimatedCost(e.target.value)}
              className="input"
              placeholder="e.g. 25000"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-currency">
              Currency
            </label>
            <input
              id="review-currency"
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="review-target-date">
              Target date
            </label>
            <input
              id="review-target-date"
              type="date"
              value={targetDate ?? ''}
              onChange={e => setTargetDate(e.target.value)}
              className="input"
            />
          </div>
          {showBorrowerSegment && (
            <div>
              <label className="field-label" htmlFor="review-borrower-segment">
                Who is this for?
              </label>
              <select
                id="review-borrower-segment"
                value={borrowerSegment}
                onChange={e => setBorrowerSegment(e.target.value)}
                className="select"
              >
                {BORROWER_SEGMENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showAssetCategory && (
            <div>
              <label className="field-label" htmlFor="review-asset-category">
                Asset or equipment type
              </label>
              <select
                id="review-asset-category"
                value={assetCategory}
                onChange={e => setAssetCategory(e.target.value)}
                className="select"
              >
                {ASSET_CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn btn-primary">
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isPresented && !editing && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 pt-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <button
            onClick={onConfirm}
            disabled={busy || facts.needsClarification}
            title={facts.needsClarification ? 'Answer the question above before confirming' : undefined}
            className="btn btn-primary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirm and continue
          </button>
          <button onClick={() => setEditing(true)} disabled={busy} className="btn btn-secondary">
            Edit details
          </button>
          {facts.needsClarification && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Answer the question above to continue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Suitability interview ─────────────────────────────────── */

/**
 * Several interview questions on one screen — the ones the engine can ask together because none of
 * them is any less applicable because of an answer to another. The assistant's reading of the
 * customer's own description arrives pre-selected, and nothing is stored until they submit, so a
 * wrong guess costs them a tap rather than a false answer on a credit application.
 */
function GroupedQuestions({
  group,
  youToldUs,
  busy,
  onSubmit,
}: {
  group: SuitabilityGroupQuestion[];
  youToldUs?: string | null;
  busy: boolean;
  onSubmit: (answers: Record<string, string[]>) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    group.forEach(q => {
      if (q.proposedCode) {
        initial[q.id] = q.type === 'multi'
          ? q.proposedCode.split(',').filter(Boolean)
          : [q.proposedCode];
      }
    });
    return initial;
  });

  const toggle = (question: SuitabilityGroupQuestion, code: string) =>
    setPicked(prev => {
      const have = prev[question.id] ?? [];
      if (question.type === 'multi') {
        return {
          ...prev,
          [question.id]: have.includes(code) ? have.filter(c => c !== code) : [...have, code],
        };
      }
      return { ...prev, [question.id]: [code] };
    });

  const complete = group.every(q => (picked[q.id]?.length ?? 0) >= (q.min ?? 1));

  return (
    <div className="panel space-y-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
          A few quick questions
        </p>
        {youToldUs && (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            You told us: {youToldUs}
          </p>
        )}
      </div>

      {group.map(question => {
        const chosen = picked[question.id] ?? [];
        return (
          <div key={question.id} className="space-y-3">
            <h2
              className="serif text-[20px] font-medium leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {question.text}
            </h2>

            {question.proposedLabel && chosen.length > 0 && (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                Taken from what you said earlier — change it if that is not right.
              </p>
            )}

            {question.conditions && question.conditions.length > 0 && (
              <div className="alert alert-info" role="note">
                <div className="flex-1 text-sm">
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    To qualify, you&apos;ll need to provide:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {question.conditions.map(c => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Nothing to upload now.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {question.options.map(option => {
                const active = chosen.includes(option.code);
                return (
                  <button
                    key={option.code}
                    onClick={() => toggle(question, option.code)}
                    disabled={busy}
                    aria-pressed={question.type === 'multi' ? active : undefined}
                    className={`chip transition-colors disabled:opacity-40 ${
                      active
                        ? '!bg-black/90 !text-white dark:!bg-white dark:!text-black'
                        : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={() => onSubmit(picked)}
        disabled={busy || !complete}
        className="btn btn-primary btn-sm"
      >
        Continue
      </button>
    </div>
  );
}

interface SuitabilityPanelProps {
  stage: SuitabilityStage;
  busy: boolean;
  preparingProductId: string | null;
  onReason: (reasonCode: string) => void;
  onBorrowerType: (code: string) => void;
  onAnswer: (stepId: string, codes: string[]) => void;
  onAnswerGroup: (answers: Record<string, string[]>) => void;
  onConfirm: (stepId: string, accept: boolean) => void;
  onRetry: () => void;
  onStart: (productId: string) => void;
}

/**
 * Renders whichever step the rule engine says we are on.
 *
 * The component deliberately holds no journey logic: it never decides what comes after an answer,
 * because the engine re-derives the path from the stored answers and a second copy of that path in
 * the browser is how a UI and an audit record start disagreeing about what a customer was told.
 */
function SuitabilityPanel({
  stage,
  busy,
  preparingProductId,
  onReason,
  onBorrowerType,
  onAnswer,
  onAnswerGroup,
  onConfirm,
  onRetry,
  onStart,
}: SuitabilityPanelProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const [correctingType, setCorrectingType] = useState(false);

  const isMulti = stage.questionType === 'multi';
  const recommended = stage.recommended ?? [];
  const unavailable = stage.unavailableCategories ?? [];

  /* The assistant read this out of what the customer already said. It is shown as a proposal, never
     applied: one click either accepts it or hands the choice back to them. */
  if (stage.state === 'CONFIRM' && stage.proposal) {
    const p = stage.proposal;
    return (
      <div className="panel space-y-4 p-5">
        <p className="text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
          Let me check I understood
        </p>
        <h2 className="serif text-[22px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
          {p.stepId === 'reason' ? `So the main reason is: ${p.label}. Is that right?`
            : `I have taken your answer as “${p.label}”. Right?`}
        </h2>
        {p.fromUtterance && (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            From what you said earlier: “{p.fromUtterance}”
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onConfirm(p.stepId, true)}
            disabled={busy}
            className="btn btn-primary btn-sm"
          >
            Yes, that&apos;s it
          </button>
          <button
            onClick={() => onConfirm(p.stepId, false)}
            disabled={busy}
            className="btn btn-secondary btn-sm"
          >
            No, let me choose
          </button>
        </div>
      </div>
    );
  }

  /* Both ask the customer to pick one of the offered options; only which fact the answer writes
     differs, so they share a renderer rather than duplicating the list. */
  if (stage.state === 'REASON_REQUIRED' || stage.state === 'BORROWER_TYPE_REQUIRED') {
    const basis = stage.borrowingTypeBasis;
    const choose = (code: string) =>
      stage.state === 'BORROWER_TYPE_REQUIRED' ? onBorrowerType(code) : onReason(code);
    return (
      <div className="panel space-y-4 p-5">
        <h2 className="section-title">{stage.message}</h2>
        {/* The interview decided farm-versus-business from the sector on the account rather than
            asking. Saying so gives the customer the chance to correct a classification that would
            otherwise quietly decide which products they are offered. */}
        {basis && (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {basis.statement}
            </p>
            {correctingType ? (
              <div className="grid grid-cols-1 gap-2 pt-1">
                {(basis.options ?? []).map(option => (
                  <button
                    key={option.code}
                    onClick={() => {
                      setCorrectingType(false);
                      onBorrowerType(option.code);
                    }}
                    disabled={busy}
                    className="rounded-xl px-4 py-2.5 text-left text-sm leading-snug transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
                    style={{ border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setCorrectingType(true)}
                disabled={busy}
                className="text-sm font-medium transition-colors hover:underline disabled:opacity-40"
                style={{ color: 'var(--brand-on-soft)' }}
              >
                Not right?
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-2">
          {stage.choices.map(choice => (
            <button
              key={choice.code}
              onClick={() => choose(choice.code)}
              disabled={busy}
              className="rounded-xl px-4 py-3 text-left text-base leading-snug transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
              style={{ border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Take the one that fits best — you can change your mind before submitting anything.
        </p>
      </div>
    );
  }

  if (stage.state === 'ASKING' && stage.group && stage.group.length > 1) {
    /* Keyed on the question set so a new screen starts from blank rather than carrying a
       selection over from the questions it replaced. */
    return (
      <GroupedQuestions
        key={stage.group.map(q => q.id).join('-')}
        group={stage.group}
        youToldUs={stage.youToldUs}
        busy={busy}
        onSubmit={onAnswerGroup}
      />
    );
  }

  if (stage.state === 'ASKING') {
    return (
      <div className="panel space-y-5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
            Question {stage.questionNumber} of {stage.questionTotal}
          </p>
          {stage.youToldUs && (
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
              You told us: {stage.youToldUs}
            </p>
          )}
        </div>

        {stage.conditions && stage.conditions.length > 0 && (
          <div className="alert alert-info" role="note">
            <div className="flex-1 text-sm">
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                To qualify, you&apos;ll need to provide:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {stage.conditions.map(c => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Nothing to upload now.
              </p>
            </div>
          </div>
        )}

        <h2 className="serif text-[22px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
          {stage.message}
        </h2>

        <div className="flex flex-wrap gap-2">
          {stage.choices.map(choice => {
            const active = picked.includes(choice.code);
            return (
              <button
                key={choice.code}
                onClick={() =>
                  isMulti
                    ? setPicked(prev =>
                        prev.includes(choice.code)
                          ? prev.filter(c => c !== choice.code)
                          : [...prev, choice.code]
                      )
                    : onAnswer(stage.expectedStepId!, [choice.code])
                }
                disabled={busy}
                aria-pressed={isMulti ? active : undefined}
                className={`chip transition-colors disabled:opacity-40 ${
                  active
                    ? '!bg-black/90 !text-white dark:!bg-white dark:!text-black'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {choice.label}
              </button>
            );
          })}
        </div>

        {isMulti && (
          <button
            onClick={() => onAnswer(stage.expectedStepId!, picked)}
            disabled={busy || picked.length === 0}
            className="btn btn-primary btn-sm"
          >
            Continue
          </button>
        )}

        {stage.helpText && (
          <div className="text-sm">
            <button
              onClick={() => setShowWhy(v => !v)}
              className="font-medium transition-colors hover:underline"
              style={{ color: 'var(--brand-on-soft)' }}
              aria-expanded={showWhy}
            >
              Why are we asking?
            </button>
            {showWhy && (
              <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
                {stage.helpText}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (stage.state === 'READY') {
    return (
      <div className="space-y-4">
        <div className="alert alert-info" role="status">
          <span className="flex-1 text-sm">{stage.notADecisionStatement}</span>
        </div>

        <div className="panel space-y-4 p-5">
          {recommended.length > 0 && <h2 className="section-title">Products that may suit</h2>}
          {recommended.length > 0 && stage.suggestionReason && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Because {stage.suggestionReason}.
            </p>
          )}

          {recommended.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Nothing online fits this</p>
              <p className="empty-state-text">
                {stage.message}
                {stage.supportReference ? ` Quote ${stage.supportReference} if you'd like to ask about it.` : ''}
              </p>
              <Link href="/portal/products" className="btn btn-secondary btn-sm mt-4">
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recommended.map((p, i) => (
                <div key={p.productId} className="panel flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {p.productName}
                      </p>
                      {p.description && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {p.description}
                        </p>
                      )}
                    </div>
                    {i === 0 && <span className="badge badge-success shrink-0">Suggested</span>}
                  </div>
                  {p.needsReview && (
                    <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      We&apos;ll need a bit more information before confirming this one.
                    </p>
                  )}
                  <button
                    onClick={() => onStart(p.productId)}
                    disabled={preparingProductId !== null}
                    className="btn btn-primary btn-sm mt-4 self-start"
                  >
                    {preparingProductId === p.productId
                      ? 'Starting your application…'
                      : 'Start this application'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {unavailable.length > 0 && (
            <div className="space-y-1 border-t pt-4" style={{ borderColor: 'var(--surface-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Not available online
              </p>
              {unavailable.map(u => (
                <p key={u.code} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {u.name} — a colleague can talk that one through with you.
                </p>
              ))}
            </div>
          )}

          {stage.answered && stage.answered.length > 0 && (
            <details className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <summary className="cursor-pointer font-medium">What you told us</summary>
              <ul className="mt-2 space-y-1 pl-4">
                {stage.answered.map((a, i) => (
                  <li key={`${a.question}-${i}`}>
                    {a.question} <span style={{ color: 'var(--text-muted)' }}>— {a.answer}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {stage.supportReference && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Reference {stage.supportReference} — give this to a colleague if you want to ask how we
              picked these.
            </p>
          )}
        </div>

        <p className="text-center text-sm">
          <Link
            href="/portal/products"
            className="font-medium transition-colors hover:underline"
            style={{ color: 'var(--brand-on-soft)' }}
          >
            Or browse all products
          </Link>
        </p>
      </div>
    );
  }

  /* Anything the engine could not answer, said plainly rather than papered over. The heading stays
     neutral because NOT_APPLICABLE covers both "not open to your account" and "nothing to check for
     this need" — only the bank's own message knows which, so the panel must not pre-empt it. */
  return (
    <div className="panel space-y-4 p-5">
      <h2 className="section-title">Guided suitability</h2>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {stage.message}
      </p>
      {stage.state === 'ENGINE_UNAVAILABLE' && (
        <button onClick={onRetry} disabled={busy} className="btn btn-secondary btn-sm">
          Try again
        </button>
      )}
      <Link href="/portal/products" className="btn btn-secondary btn-sm">
        Browse products instead
      </Link>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */

export default function AiAssistantPage() {
  const router = useRouter();
  const [journey, setJourney] = useState<CreditJourney | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notEnabled, setNotEnabled] = useState(false);
  const [intentOptions, setIntentOptions] = useState<IntentOption[]>(DEFAULT_INTENT_OPTIONS);
  const [preparingProductId, setPreparingProductId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [journey?.recentMessages.length]);

  function handleApiError(err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 404) {
      setNotEnabled(true);
    } else {
      setError(e?.message || 'Something went wrong. Please try again.');
    }
  }

  /**
   * The bff's circuit breaker answers a failed call with a 200 and a body that has no journeyId.
   * Treating that as a journey is what used to strand the page: it wiped the intent options out from
   * under the "choose one of the options below" message, then posted every later message to
   * /credit-journeys/null/messages. So a body without an id is an error, not a state — and whatever
   * the customer already has on screen stays on it.
   */
  function adoptJourney(result: CreditJourney) {
    if (!result.journeyId) {
      setError('The AI assistant is unavailable right now. Nothing you have told us is lost — '
        + 'please try again in a moment.');
      return;
    }
    setJourney(result);
    if (result.intentOptions?.length) setIntentOptions(result.intentOptions);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft('');
    try {
      const result = journey
        ? await aiCreditJourneyService.sendMessage(journey.journeyId, text)
        : await aiCreditJourneyService.start(text);
      adoptJourney(result);
    } catch (err) {
      handleApiError(err);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectIntent(code: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = journey
        ? await aiCreditJourneyService.selectIntent(journey.journeyId, code)
        : await aiCreditJourneyService.start(undefined, code);
      adoptJourney(result);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleStartApplication(productId: string) {
    if (!journey || preparingProductId) return;
    setPreparingProductId(productId);
    setError(null);
    try {
      const result = await aiCreditJourneyService.prepareApplication(journey.journeyId, productId);
      router.push(`/portal/applications/${result.applicationId}`);
    } catch (err) {
      handleApiError(err);
      setPreparingProductId(null);
    }
  }

  /**
   * Every one of these replaces the journey rather than patching the stage locally, because the
   * engine re-derives the next question from the stored answers — a client-side guess about what
   * comes next is exactly the drift this design avoids.
   */
  async function applyStage(next: SuitabilityStage) {
    if (!journey) return;
    const refreshed = await aiCreditJourneyService.getJourney(journey.journeyId);
    setJourney({ ...refreshed, suitability: next });
  }

  async function handleSuitabilityReason(reasonCode: string) {
    if (!journey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyStage(await aiCreditJourneyService.selectSuitabilityReason(journey.journeyId, reasonCode));
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  /** Who the borrowing is for, asked when the confirmed need never said. */
  async function handleBorrowerType(code: string) {
    if (!journey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyStage(await aiCreditJourneyService.setBorrowerType(journey.journeyId, code));
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSuitabilityAnswer(stepId: string, codes: string[]) {
    if (!journey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyStage(await aiCreditJourneyService.answerSuitability(journey.journeyId, stepId, codes));
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  /** A grouped screen, submitted as one set so the engine never sees a half-answered page. */
  async function handleSuitabilityAnswerGroup(answers: Record<string, string[]>) {
    if (!journey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyStage(await aiCreditJourneyService.answerSuitabilityGroup(journey.journeyId, answers));
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  /** Yes or no to something the assistant inferred. This is the only path that accepts a guess. */
  async function handleConfirmProposal(stepId: string, accept: boolean) {
    if (!journey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyStage(await aiCreditJourneyService.confirmProposal(journey.journeyId, stepId, accept));
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSuitabilityRetry() {
    if (!journey || busy) return;
    setBusy(true);
    setError(null);
    try {
      const stage = await aiCreditJourneyService.getSuitability(journey.journeyId);
      setJourney({ ...journey, suitability: stage });
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!journey?.currentReview || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiCreditJourneyService.confirmReview(
        journey.journeyId,
        journey.currentReview.reviewId
      );
      adoptJourney(result);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestRevision(updates: Record<string, unknown>) {
    if (!journey?.currentReview || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiCreditJourneyService.requestRevision(
        journey.journeyId,
        journey.currentReview.reviewId,
        updates
      );
      adoptJourney(result);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  const messages = journey?.recentMessages ?? [];
  const review = journey?.currentReview ?? null;
  // The interview is the only source of what is suitable. The page no longer matches a purpose to
  // product types itself, so the same answers cannot produce a different short list in the browser
  // than the rule engine produced for the audit record.
  const suitability = journey?.suitability ?? null;

  if (notEnabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          href="/portal"
          className="mb-4 inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to overview
        </Link>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--brand-on-soft)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h1 className="empty-state-title">The AI assistant isn&apos;t available yet</h1>
          <p className="empty-state-text">
            This preview feature isn&apos;t enabled for your bank yet. You can still apply for a
            product using the standard application flow.
          </p>
          <Link href="/portal/products" className="btn btn-primary mt-5">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="mesh-hero aurora relative overflow-hidden rounded-3xl p-6 text-white shadow-float">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div>
            <h1 className="serif text-[28px] font-medium leading-tight tracking-tight sm:text-[32px]">Rayva AI credit assistant</h1>
            <p className="mt-1.5 text-sm text-white/70">
              Tell me what you need credit for, in your own words — I&apos;ll help you get started.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="flex-1 text-sm">{error}</span>
          {draft.trim() && (
            <button onClick={() => handleSend()} className="btn btn-sm btn-outline shrink-0">
              Try again
            </button>
          )}
        </div>
      )}

      {/* Conversation */}
      <div className="panel">
        <div
          ref={scrollRef}
          className="max-h-[420px] min-h-[180px] space-y-4 overflow-y-auto p-5"
          role="region"
          aria-label="Conversation with Rayva AI, scrollable"
          tabIndex={0}
        >
          <div role="log" aria-live="polite" aria-relevant="additions text" className="space-y-4">
            {messages.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Start by describing what you need credit for, or pick an option below.
                </p>
              </div>
            )}
            {messages.map(msg => {
              const mine = msg.role === 'CUSTOMER';
              const isNotice = msg.role === 'SYSTEM_NOTICE';
              return (
                <div key={msg.messageId} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs rounded-2xl px-4 py-3 text-base leading-relaxed lg:max-w-md ${
                      mine ? 'rounded-br-sm text-white' : 'rounded-bl-sm'
                    }`}
                    style={
                      mine
                        ? { backgroundColor: 'var(--brand)' }
                        : {
                            backgroundColor: isNotice ? 'rgba(16,185,129,0.14)' : 'var(--surface-input)',
                            color: 'var(--text-primary)',
                          }
                    }
                  >
                    {!mine && (
                      <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--brand-on-soft)' }}>
                        {isNotice ? 'Rayva' : 'Rayva AI'}
                      </p>
                    )}
                    {mine && <span className="sr-only">You said: </span>}
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-sm px-4 py-3"
                  style={{ backgroundColor: 'var(--surface-input)' }}
                >
                  <span className="sr-only">Rayva AI is typing…</span>
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-40" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intent option chips */}
        {intentOptions.length > 0 && (!review || review.status !== 'CONFIRMED') && (
          <div
            className="flex flex-wrap gap-2 px-5 pb-4 pt-4"
            style={{ borderTop: '1px solid var(--surface-border)' }}
          >
            <h2 className="sr-only">Suggested options</h2>
            {intentOptions.map(opt => (
              <button
                key={opt.code}
                onClick={() => handleSelectIntent(opt.code)}
                disabled={busy}
                title={opt.description}
                className="chip transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="px-5 py-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <label className="field-label" htmlFor="ai-message">
            Your message
          </label>
          <div className="flex items-center gap-3">
            <input
              id="ai-message"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Describe what you need credit for…"
              disabled={busy}
              autoComplete="off"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send message"
              className="btn btn-primary h-11 w-11 shrink-0 rounded-xl p-0"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Review card */}
      {review && (
        <ReviewCard
          facts={review.facts}
          status={review.status}
          onConfirm={handleConfirm}
          onRequestRevision={handleRequestRevision}
          busy={busy}
        />
      )}

      {review?.status === 'CONFIRMED' && suitability && (
        <SuitabilityPanel
          /* Remounting per question clears any half-picked multi-select answer. */
          key={suitability.expectedStepId ?? suitability.state}
          stage={suitability}
          busy={busy}
          preparingProductId={preparingProductId}
          onReason={handleSuitabilityReason}
          onBorrowerType={handleBorrowerType}
          onAnswer={handleSuitabilityAnswer}
          onAnswerGroup={handleSuitabilityAnswerGroup}
          onConfirm={handleConfirmProposal}
          onRetry={handleSuitabilityRetry}
          onStart={handleStartApplication}
        />
      )}
    </div>
  );
}
