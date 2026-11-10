'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Glyph from '@/components/ui/Glyph';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import {
  formatEuro,
  retailService,
  type Connect,
  type InputSource,
  type IntentResponse,
  type MoneyRequest,
  type ParsedIntent,
  type RequestProposal,
  type SendDraft,
} from '@/services/api/retail-service';
import type { ApiError } from '@/services/api/client';

export type MoneySheetMode = 'send' | 'request';

type Step =
  | 'compose'
  | 'working'
  | 'clarify'
  | 'pick'
  | 'review-send'
  | 'review-request'
  | 'authorise'
  | 'done-send'
  | 'done-request'
  | 'failed';

const EXAMPLES: Record<MoneySheetMode, string[]> = {
  send: ['Send €10 to John Payne for badminton', 'Pay Jane Blake €25 for dinner'],
  request: ['Request €15 from John Payne for badminton', 'Ask Jane Blake for €40 for tickets'],
};

const AMOUNT_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

function asApiError(err: unknown): Partial<ApiError> {
  return typeof err === 'object' && err !== null ? (err as Partial<ApiError>) : {};
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
}

function parseAmountMinor(input: string): number | null {
  const normalised = input.replace(',', '.').trim();
  if (!AMOUNT_PATTERN.test(normalised) || Number(normalised) <= 0) return null;
  return Math.round(Number(normalised) * 100);
}

function MicIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-10">
      <span
        className="h-9 w-9 rounded-full border-[3px] motion-safe:animate-spin"
        style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: React.ReactNode }) {
  const palette = {
    info: { bg: 'var(--brand-soft)', fg: 'var(--text-primary)' },
    warn: { bg: 'rgba(217, 119, 6, 0.12)', fg: 'var(--text-primary)' },
    error: { bg: 'rgba(220, 38, 38, 0.1)', fg: 'var(--text-primary)' },
  }[tone];
  return (
    <p
      role={tone === 'error' ? 'alert' : 'note'}
      className="rounded-2xl px-4 py-3 text-sm"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      {children}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {children}
      </dd>
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </label>
  );
}

export function PersonBadge({ name, subtitle }: { name: string; subtitle?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="avatar-dot h-12 w-12 shrink-0 text-sm" aria-hidden="true">
        {initials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {name}
        </p>
        {subtitle && (
          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function lastTransferLine(connect?: Connect | null, draft?: SendDraft | null): string | null {
  const last = draft?.lastTransfer ?? connect?.lastTransfer;
  if (!last) return null;
  const when = new Date(last.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${formatEuro(last.amountMinor, last.currency)} on ${when}`;
}

interface Props {
  open: boolean;
  mode: MoneySheetMode;
  onClose: () => void;
  /** Start from a known Connect (Connects page): skips speech and asks for amount and reason. */
  presetConnect?: Connect | null;
  /** Start from an existing draft, e.g. paying a request: opens at review with fixed terms. */
  initialDraft?: SendDraft | null;
  /** Called after a payment or request is completed so the page can refresh. */
  onCompleted?: () => void;
}

export function MoneySheet({ open, mode, onClose, presetConnect, initialDraft, onCompleted }: Props) {
  const [step, setStep] = useState<Step>('compose');
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [heardVia, setHeardVia] = useState<InputSource>('TEXT');
  const [message, setMessage] = useState<string | null>(null);
  const [workingLabel, setWorkingLabel] = useState('Working on it…');
  const [matches, setMatches] = useState<Connect[]>([]);
  const [parsed, setParsed] = useState<ParsedIntent | null>(null);
  const [connect, setConnect] = useState<Connect | null>(null);
  const [draft, setDraft] = useState<SendDraft | null>(null);
  const [proposal, setProposal] = useState<RequestProposal | null>(null);
  const [sentRequest, setSentRequest] = useState<MoneyRequest | null>(null);
  const [password, setPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const clientRequestId = useRef(retailService.newClientRequestId());
  const textRef = useRef<HTMLTextAreaElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const isRequestDraft = draft?.intentSource === 'REQUEST';

  const reset = useCallback(() => {
    setStep(initialDraft ? 'review-send' : 'compose');
    setText('');
    setTranscript(null);
    setHeardVia('TEXT');
    setMessage(null);
    setMatches([]);
    setParsed(null);
    setConnect(null);
    setDraft(initialDraft ?? null);
    setProposal(null);
    setSentRequest(null);
    setPassword('');
    setTwoFactor('');
    setNeedsTwoFactor(false);
    setAuthError(null);
    setBusy(false);
    setEditingAmount(false);
    setFormAmount('');
    setFormPurpose('');
    setFormError(null);
    clientRequestId.current = retailService.newClientRequestId();
  }, [initialDraft]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (step === 'compose') textRef.current?.focus();
    if (step === 'authorise') passwordRef.current?.focus();
  }, [open, step]);

  const close = useCallback(() => {
    if (busy) return;
    // Leaving a draft that was never authorised releases it, so it cannot linger as a pending payment.
    if (draft && (step === 'review-send' || step === 'authorise') && !initialDraft) {
      retailService.cancelDraft(draft.draftId).catch(() => undefined);
    }
    onClose();
  }, [busy, draft, initialDraft, onClose, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const applyIntent = useCallback((result: IntentResponse, source: InputSource) => {
    setTranscript(result.transcript);
    setMessage(result.message);
    setParsed(result.intent ?? null);
    setHeardVia(source);
    switch (result.status) {
      case 'REVIEW_REQUIRED':
      case 'UPDATED':
        setDraft(result.draft ?? null);
        setConnect(result.connect ?? null);
        setEditingAmount(false);
        setMessage(null);
        setStep('review-send');
        break;
      case 'CONFIRMED':
        setDraft(result.draft ?? null);
        setStep('authorise');
        break;
      case 'CANCELLED':
        setDraft(null);
        setStep('compose');
        break;
      case 'REQUEST_REVIEW':
        setProposal(result.proposal ?? null);
        setConnect(result.connect ?? null);
        setMessage(null);
        setStep('review-request');
        break;
      case 'AMBIGUOUS_RECIPIENT':
        setMatches(result.matches ?? []);
        setStep('pick');
        break;
      default:
        // NEEDS_CLARIFICATION, RECIPIENT_NOT_FOUND, BLOCKED, UNSUPPORTED, AI_UNAVAILABLE
        setStep('clarify');
    }
  }, []);

  const interpret = useCallback(
    async (input: string, source: InputSource) => {
      const trimmed = input.trim();
      if (!trimmed) return;
      setWorkingLabel('Understanding your request…');
      setStep('working');
      try {
        const result = await retailService.interpret(trimmed, source, clientRequestId.current);
        clientRequestId.current = retailService.newClientRequestId();
        applyIntent(result, source);
      } catch (err) {
        setMessage(asApiError(err).message ?? 'Something went wrong. Please try again.');
        setStep('clarify');
      }
    },
    [applyIntent]
  );

  const onRecorded = useCallback(
    async (audio: Blob) => {
      setWorkingLabel('Transcribing…');
      setStep('working');
      try {
        const { text: heard } = await retailService.transcribe(audio);
        setText(heard);
        await interpret(heard, 'VOICE');
      } catch (err) {
        setMessage(
          asApiError(err).message ??
            'We couldn’t process that recording. You can try again or type your request.'
        );
        setStep('clarify');
      }
    },
    [interpret]
  );

  const recorder = useVoiceRecorder(onRecorded);

  const pickConnect = useCallback(
    async (chosen: Connect) => {
      if (!parsed || parsed.amountMinor == null || !parsed.purpose) {
        setStep('compose');
        return;
      }
      setBusy(true);
      setWorkingLabel('Preparing your review…');
      setStep('working');
      try {
        if (parsed.action === 'REQUEST_MONEY') {
          setConnect(chosen);
          setProposal({
            connectId: chosen.connectId,
            amountMinor: parsed.amountMinor,
            purpose: parsed.purpose,
            source: heardVia,
          });
          setStep('review-request');
        } else {
          const created = await retailService.createDraft({
            connectId: chosen.connectId,
            amountMinor: parsed.amountMinor,
            purpose: parsed.purpose,
            source: heardVia,
          });
          setConnect(chosen);
          setDraft(created);
          setStep('review-send');
        }
      } catch (err) {
        setMessage(asApiError(err).message ?? 'Something went wrong. Please try again.');
        setStep('clarify');
      } finally {
        setBusy(false);
      }
    },
    [heardVia, parsed]
  );

  const submitForm = useCallback(async () => {
    if (!presetConnect) return;
    const amountMinor = parseAmountMinor(formAmount);
    if (amountMinor == null) {
      setFormError('Enter an amount in euros, for example 12.50.');
      return;
    }
    const purpose = formPurpose.trim();
    if (!purpose) {
      setFormError('Add a short reason, for example “lunch”.');
      return;
    }
    setFormError(null);
    setBusy(true);
    setWorkingLabel('Preparing your review…');
    setStep('working');
    try {
      if (mode === 'request') {
        setConnect(presetConnect);
        setProposal({ connectId: presetConnect.connectId, amountMinor, purpose, source: 'TEXT' });
        setStep('review-request');
      } else {
        const created = await retailService.createDraft({
          connectId: presetConnect.connectId,
          amountMinor,
          purpose,
          source: 'TEXT',
        });
        setConnect(presetConnect);
        setDraft(created);
        setStep('review-send');
      }
    } catch (err) {
      setFormError(asApiError(err).message ?? 'Something went wrong. Please try again.');
      setStep('compose');
    } finally {
      setBusy(false);
    }
  }, [formAmount, formPurpose, mode, presetConnect]);

  const changeAmount = useCallback(async () => {
    if (!draft) return;
    const amountMinor = parseAmountMinor(amountInput);
    if (amountMinor == null) {
      setMessage('Enter an amount in euros, for example 12.50.');
      return;
    }
    setBusy(true);
    try {
      setDraft(await retailService.updateDraft(draft, { amountMinor }));
      setEditingAmount(false);
      setMessage(null);
    } catch (err) {
      setMessage(asApiError(err).message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [amountInput, draft]);

  const confirmDraft = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      setDraft(await retailService.confirmDraft(draft));
      setStep('authorise');
    } catch (err) {
      const apiErr = asApiError(err);
      setMessage(apiErr.message ?? 'Something went wrong. Please try again.');
      if (apiErr.code === 'STALE_DRAFT') {
        retailService.getDraft(draft.draftId).then(setDraft).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const authorise = useCallback(async () => {
    if (!draft || !password) return;
    setBusy(true);
    setAuthError(null);
    try {
      const result = await retailService.authoriseDraft(draft, password, twoFactor);
      setPassword('');
      setDraft(result);
      setStep(result.status === 'FAILED' ? 'failed' : 'done-send');
      onCompleted?.();
    } catch (err) {
      const apiErr = asApiError(err);
      setPassword('');
      if (apiErr.code === 'TWO_FACTOR_REQUIRED') {
        setNeedsTwoFactor(true);
        setAuthError(apiErr.message ?? 'Enter your two-factor code.');
      } else if (apiErr.code === 'STALE_DRAFT' || apiErr.code === 'DRAFT_EXPIRED') {
        setMessage(apiErr.message ?? 'This payment changed. Please review it again.');
        retailService
          .getDraft(draft.draftId)
          .then(fresh => {
            setDraft(fresh);
            setStep(fresh.status === 'CONFIRMED' ? 'authorise' : 'review-send');
          })
          .catch(() => setStep('failed'));
      } else {
        setAuthError(apiErr.message ?? 'We couldn’t authorise that. Nothing was sent.');
      }
    } finally {
      setBusy(false);
    }
  }, [draft, onCompleted, password, twoFactor]);

  const sendRequest = useCallback(async () => {
    if (!proposal) return;
    setBusy(true);
    setMessage(null);
    try {
      setSentRequest(await retailService.createRequest(proposal));
      setStep('done-request');
      onCompleted?.();
    } catch (err) {
      setMessage(asApiError(err).message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [onCompleted, proposal]);

  const backToCompose = useCallback(() => {
    if (draft && step === 'review-send' && !initialDraft) {
      retailService.cancelDraft(draft.draftId).catch(() => undefined);
    }
    setDraft(null);
    setProposal(null);
    setMessage(null);
    setStep('compose');
  }, [draft, initialDraft, step]);

  const heading = useMemo(() => {
    switch (step) {
      case 'review-send':
        return 'Review payment';
      case 'review-request':
        return 'Review request';
      case 'authorise':
        return 'Authorise payment';
      case 'done-send':
        return draft?.executionMode === 'SANDBOX' ? 'Sandbox payment recorded' : 'Payment sent';
      case 'done-request':
        return 'Request sent';
      case 'failed':
        return 'Payment not sent';
      case 'pick':
        return 'Who did you mean?';
      default:
        return mode === 'send' ? 'Send money' : 'Request money';
    }
  }, [draft?.executionMode, mode, step]);

  if (!open) return null;

  const examples = EXAMPLES[mode];
  const recording = recorder.state === 'recording';
  const micUnavailable = recorder.state === 'unsupported' || recorder.state === 'denied';

  // Portalled to <body>: glass panels use backdrop-filter, which would otherwise trap `fixed` inside them.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={event => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="money-sheet-title"
        data-testid="money-sheet"
        className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border sm:rounded-[28px]"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--hairline)',
          boxShadow: 'var(--shadow-lg)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          className="mx-auto mt-2 h-1 w-10 rounded-full sm:hidden"
          style={{ backgroundColor: 'var(--hairline-strong)' }}
        />
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--brand-on-soft)' }}
            >
              Connects
            </p>
            <h2 id="money-sheet-title" className="serif mt-1 text-[24px] font-medium">
              {heading}
            </h2>
          </div>
          <button type="button" onClick={close} className="icon-btn" aria-label="Close" disabled={busy}>
            <Glyph name="x" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* Compose: voice first, typing always available */}
          {step === 'compose' && !presetConnect && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={recording ? recorder.stop : recorder.start}
                  disabled={recorder.state === 'requesting' || micUnavailable}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                  aria-pressed={recording}
                  data-testid="mic-button"
                  className="relative flex h-20 w-20 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40"
                  style={{ background: 'var(--tile-active)', boxShadow: 'var(--tile-active-shadow)' }}
                >
                  {recording && (
                    <span
                      className="absolute inset-0 rounded-full motion-safe:animate-ping"
                      style={{ backgroundColor: 'var(--brand)', opacity: 0.35 }}
                    />
                  )}
                  <MicIcon className="relative h-8 w-8" />
                </button>
                <p
                  className="text-center text-sm"
                  style={{ color: 'var(--text-muted)' }}
                  data-testid="mic-status"
                  aria-live="polite"
                >
                  {recording
                    ? 'Listening… tap to finish'
                    : recorder.state === 'requesting'
                      ? 'Waiting for microphone access…'
                      : recorder.state === 'denied'
                        ? 'Microphone access is blocked. You can type instead.'
                        : recorder.state === 'unsupported'
                          ? 'Voice isn’t supported in this browser. You can type instead.'
                          : recorder.state === 'error'
                            ? 'We couldn’t use the microphone. You can type instead.'
                            : 'Tap and speak'}
                </p>
              </div>

              <div>
                <FieldLabel htmlFor="money-text">Or type it</FieldLabel>
                <textarea
                  id="money-text"
                  ref={textRef}
                  rows={2}
                  maxLength={300}
                  value={text}
                  onChange={event => setText(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void interpret(text, 'TEXT');
                    }
                  }}
                  placeholder={examples[0]}
                  className="input w-full resize-none"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {examples.map(example => (
                    <button key={example} type="button" className="pill-btn text-xs" onClick={() => setText(example)}>
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {message && <Notice tone="info">{message}</Notice>}

              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={!text.trim()}
                onClick={() => void interpret(text, 'TEXT')}
              >
                Continue
              </button>
              <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                You’ll review everything before any payment is authorised.
              </p>
            </div>
          )}

          {/* Compose with a chosen Connect: no speech needed */}
          {step === 'compose' && presetConnect && (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                void submitForm();
              }}
            >
              <PersonBadge
                name={presetConnect.displayName}
                subtitle={presetConnect.maskedIban ? `Account ${presetConnect.maskedIban}` : null}
              />
              <div>
                <FieldLabel htmlFor="form-amount">Amount (EUR)</FieldLabel>
                <input
                  id="form-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  className="input w-full"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={event => setFormAmount(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="form-purpose">What’s it for?</FieldLabel>
                <input
                  id="form-purpose"
                  maxLength={140}
                  className="input w-full"
                  placeholder="e.g. Badminton"
                  value={formPurpose}
                  onChange={event => setFormPurpose(event.target.value)}
                />
              </div>
              {formError && <Notice tone="error">{formError}</Notice>}
              <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                Review
              </button>
            </form>
          )}

          {step === 'working' && <Spinner label={workingLabel} />}

          {/* Clarify / not found / blocked / unavailable */}
          {step === 'clarify' && (
            <div className="space-y-4">
              {transcript && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  You said: <span style={{ color: 'var(--text-primary)' }}>“{transcript}”</span>
                </p>
              )}
              <Notice tone="warn">{message ?? 'I need a little more detail.'}</Notice>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => {
                  setMessage(null);
                  setStep('compose');
                }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Ambiguous recipient */}
          {step === 'pick' && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {message}
              </p>
              <ul className="space-y-2">
                {matches.map(match => (
                  <li key={match.connectId}>
                    <button
                      type="button"
                      onClick={() => void pickConnect(match)}
                      disabled={busy}
                      data-testid="pick-connect"
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors"
                      style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--tile-bg)' }}
                    >
                      <PersonBadge
                        name={match.displayName}
                        subtitle={[
                          match.maskedIban && `Account ${match.maskedIban}`,
                          match.maskedPhone && `Phone ${match.maskedPhone}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                      <Glyph name="chevron" className="h-4 w-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-ghost w-full" onClick={backToCompose}>
                None of these
              </button>
            </div>
          )}

          {/* Review a send */}
          {step === 'review-send' && draft && (
            <div className="space-y-4" data-testid="review-card">
              {transcript && heardVia === 'VOICE' && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  I heard: <span style={{ color: 'var(--text-primary)' }}>“{transcript}”</span>{' '}
                  <button type="button" className="underline" onClick={backToCompose}>
                    Edit
                  </button>
                </p>
              )}
              <PersonBadge
                name={draft.recipientName}
                subtitle={
                  [
                    connect?.verifiedName ? 'Verified Superbank customer' : null,
                    draft.recipientMaskedPhone ? `Phone ${draft.recipientMaskedPhone}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null
                }
              />
              <div className="text-center">
                <p className="serif text-[40px] font-medium leading-none" data-testid="review-amount">
                  {formatEuro(draft.amountMinor, draft.currency)}
                </p>
                {!isRequestDraft && !editingAmount && (
                  <button
                    type="button"
                    className="mt-2 text-sm underline"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => {
                      setAmountInput((draft.amountMinor / 100).toFixed(2));
                      setEditingAmount(true);
                    }}
                  >
                    Change amount
                  </button>
                )}
              </div>
              {editingAmount && (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FieldLabel htmlFor="amount-edit">New amount (EUR)</FieldLabel>
                    <input
                      id="amount-edit"
                      inputMode="decimal"
                      className="input w-full"
                      value={amountInput}
                      onChange={event => setAmountInput(event.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void changeAmount()}>
                    Update
                  </button>
                </div>
              )}
              <dl className="divide-y rounded-2xl border px-4" style={{ borderColor: 'var(--hairline)' }}>
                <Row label="Reason">{draft.purpose}</Row>
                <Row label="From">
                  {draft.sourceAccountName}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>{draft.sourceMaskedIban}</span>
                </Row>
                <Row label="To account">{draft.recipientMaskedIban}</Row>
                {lastTransferLine(connect, draft) && <Row label="Last paid">{lastTransferLine(connect, draft)}</Row>}
              </dl>
              {isRequestDraft && (
                <Notice tone="info">The amount and reason come from the request and can’t be changed.</Notice>
              )}
              <Notice tone="info">
                {draft.executionMode === 'SANDBOX'
                  ? 'Sandbox mode: this payment is simulated. No money will move and nothing will be booked on your accounts.'
                  : 'This payment is sent immediately from your account and appears in both accounts’ transaction history. It can’t be undone.'}
              </Notice>
              {message && <Notice tone="error">{message}</Notice>}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={busy}
                  onClick={() => void confirmDraft()}
                  data-testid="confirm-draft"
                >
                  Confirm details
                </button>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  disabled={busy}
                  onClick={initialDraft ? close : backToCompose}
                >
                  {initialDraft ? 'Not now' : 'Start over'}
                </button>
              </div>
            </div>
          )}

          {/* Review a request */}
          {step === 'review-request' && proposal && connect && (
            <div className="space-y-4" data-testid="review-card">
              {transcript && heardVia === 'VOICE' && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  I heard: <span style={{ color: 'var(--text-primary)' }}>“{transcript}”</span>{' '}
                  <button type="button" className="underline" onClick={backToCompose}>
                    Edit
                  </button>
                </p>
              )}
              <PersonBadge
                name={connect.displayName}
                subtitle={connect.verifiedName ? 'Verified Superbank customer' : null}
              />
              <div className="text-center">
                <p className="serif text-[40px] font-medium leading-none" data-testid="review-amount">
                  {formatEuro(proposal.amountMinor)}
                </p>
              </div>
              <dl className="divide-y rounded-2xl border px-4" style={{ borderColor: 'var(--hairline)' }}>
                <Row label="Reason">{proposal.purpose}</Row>
                <Row label="Asking">{connect.displayName}</Row>
                {lastTransferLine(connect) && <Row label="Last paid">{lastTransferLine(connect)}</Row>}
              </dl>
              <Notice tone="info">
                This only sends a request. Nothing is taken from your account or theirs, and they choose whether to
                pay.
              </Notice>
              {message && <Notice tone="error">{message}</Notice>}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={busy}
                  onClick={() => void sendRequest()}
                  data-testid="send-request"
                >
                  Send request
                </button>
                <button type="button" className="btn btn-outline flex-1" disabled={busy} onClick={backToCompose}>
                  Start over
                </button>
              </div>
            </div>
          )}

          {/* Authorise with password */}
          {step === 'authorise' && draft && (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                void authorise();
              }}
            >
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--hairline)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  You’re about to pay
                </p>
                <p className="serif text-[28px] font-medium">{formatEuro(draft.amountMinor, draft.currency)}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  to {draft.recipientName} for {draft.purpose}
                </p>
              </div>
              <div>
                <FieldLabel htmlFor="auth-password">Your password</FieldLabel>
                <input
                  id="auth-password"
                  ref={passwordRef}
                  type="password"
                  autoComplete="current-password"
                  className="input w-full"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                />
              </div>
              {needsTwoFactor && (
                <div>
                  <FieldLabel htmlFor="auth-2fa">Two-factor code</FieldLabel>
                  <input
                    id="auth-2fa"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="input w-full"
                    value={twoFactor}
                    onChange={event => setTwoFactor(event.target.value)}
                  />
                </div>
              )}
              {authError && <Notice tone="error">{authError}</Notice>}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Saying “yes” never sends money. Only entering your password does.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={busy || !password}
                  data-testid="authorise-payment"
                >
                  {busy ? 'Authorising…' : 'Authorise payment'}
                </button>
                <button type="button" className="btn btn-outline flex-1" disabled={busy} onClick={close}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Receipt */}
          {step === 'done-send' && draft && (
            <div className="space-y-4" data-testid="receipt">
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-white"
                  style={{ background: 'var(--tile-active)' }}
                >
                  <Glyph name="check" className="h-7 w-7" strokeWidth={2.2} />
                </span>
                <p className="serif text-[34px] font-medium leading-none">
                  {formatEuro(draft.amountMinor, draft.currency)}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  to {draft.recipientName}
                </p>
              </div>
              {draft.executionMode === 'SANDBOX' && (
                <Notice tone="warn">
                  <strong>Sandbox payment.</strong>{' '}
                  {draft.message ?? 'No money has moved and no ledger entry was booked.'}
                </Notice>
              )}
              <dl className="divide-y rounded-2xl border px-4" style={{ borderColor: 'var(--hairline)' }}>
                <Row label="Reference">
                  <span data-testid="receipt-reference">{draft.receiptReference}</span>
                </Row>
                <Row label="Reason">{draft.purpose}</Row>
                <Row label="From">
                  {draft.sourceAccountName} {draft.sourceMaskedIban}
                </Row>
                <Row label="Status">{draft.status === 'COMPLETED_SANDBOX' ? 'Completed (sandbox)' : 'Completed'}</Row>
              </dl>
              <button type="button" className="btn btn-primary w-full" onClick={onClose}>
                Done
              </button>
            </div>
          )}

          {step === 'done-request' && sentRequest && (
            <div className="space-y-4" data-testid="request-sent">
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-white"
                  style={{ background: 'var(--tile-active)' }}
                >
                  <Glyph name="send" className="h-6 w-6" strokeWidth={2} />
                </span>
                <p className="serif text-[34px] font-medium leading-none">
                  {formatEuro(sentRequest.amountMinor, sentRequest.currency)}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  requested from {sentRequest.counterpartyName}
                </p>
              </div>
              <Notice tone="info">
                They’ll see it in their Requests. Nothing has been taken from either account.
              </Notice>
              <button type="button" className="btn btn-primary w-full" onClick={onClose}>
                Done
              </button>
            </div>
          )}

          {step === 'failed' && (
            <div className="space-y-4" data-testid="payment-failed">
              <Notice tone="error">
                {draft?.failureReason ?? message ?? 'We couldn’t send that payment.'} Nothing was taken from your
                account.
              </Notice>
              <button type="button" className="btn btn-primary w-full" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
