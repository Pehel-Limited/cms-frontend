'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  knowledgeChatService,
  type KnowledgeCitation,
} from '@/services/api/knowledge-chat-service';

/* What Rayva can be asked on the first tap. These are questions the published corpus
   actually answers — it reads only sources the bank has released to customers, so a chip
   with nothing behind it becomes a broken promise on the first screen. */
const STARTER_QUESTIONS = [
  'What is your current variable mortgage rate?',
  'What rates do you offer on business loans?',
  'Show me fixed versus variable rates',
];

interface ChatTurn {
  id: string;
  role: 'CUSTOMER' | 'RAYVA';
  text: string;
  /**
   * Set when Rayva had nothing grounded to say. Kept on the turn rather than derived from
   * the text so the handoff row survives a reload and cannot appear on a real answer.
   */
  unresolved?: 'NOT_FOUND' | 'INSUFFICIENT_EVIDENCE' | 'FAILED';
  citations?: KnowledgeCitation[];
}

const STORAGE_KEY = 'rayva.chat.v1';

/* Timed off the clock rather than a fixed rotation: the honest signal that a remote model
   is thinking is that the words change when it has been a while, not every 700ms. */
function thinkingLine(seconds: number): string {
  if (seconds < 3) return 'Let me look for that…';
  if (seconds < 8) return 'Reading the pages we publish…';
  if (seconds < 16) return 'Checking the passage actually answers you…';
  return 'Still going — the answer service is slow right now.';
}

const UNRESOLVED_COPY: Record<string, string> = {
  NOT_FOUND:
    "I couldn't find that in anything we've published to you, and I'm not going to guess at a number or a rule.",
  INSUFFICIENT_EVIDENCE:
    'I found pages on that subject, but none of them actually answer what you asked. I would rather say so than pad it out.',
  FAILED:
    'Our answer service isn’t responding right now, so I couldn’t write this up for you.',
};

let turnCounter = 0;
const nextId = () => `t${Date.now()}-${++turnCounter}`;

function snippetOf(c: KnowledgeCitation): string {
  return (c.snippet || '').replace(/\s+/g, ' ').trim();
}

/**
 * Turns the model's own [n] markers into buttons that jump to passage n, and its **bold**
 * into emphasis. Both are handled here rather than with a markdown renderer because this is
 * the only formatted text in the portal, and a parser would have to be told to leave the
 * citation markers alone anyway.
 */
function AnswerBody({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  return (
    <>
      {text.split(/(\[\d+\]|\*\*[^*\n]+\*\*)/g).map((part, i) => {
        const marker = /^\[(\d+)\]$/.exec(part);
        if (marker) {
          const n = Number(marker[1]);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCite(n)}
              className="rayva-cite"
              aria-label={`Show source ${n}`}
            >
              {n}
            </button>
          );
        }
        const bold = /^\*\*([^*\n]+)\*\*$/.exec(part);
        if (bold) {
          return (
            <strong key={i} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {bold[1]}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function CitationCard({
  index,
  citation,
  open,
  onToggle,
}: {
  index: number;
  citation: KnowledgeCitation;
  open: boolean;
  onToggle: () => void;
}) {
  const where = [
    citation.headingPath?.replace(/\s*>\s*/g, ' · ').trim(),
    citation.pageFrom ? `p. ${citation.pageFrom}${citation.pageTo && citation.pageTo !== citation.pageFrom ? `–${citation.pageTo}` : ''}` : null,
    citation.sectionReference,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rayva-source" id={`rayva-source-${index}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="rayva-source-head"
      >
        <span className="rayva-source-no">{index}</span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {citation.sourceTitle}
          </span>
          {where && (
            <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {where}
            </span>
          )}
        </span>
        <svg
          className="h-4 w-4 shrink-0 transition-transform"
          style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : undefined }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="rayva-source-body">
          {snippetOf(citation) || 'No text was returned for this passage.'}
        </p>
      )}
    </div>
  );
}

/* ─── The panel itself ───────────────────────────────────────── */

export function RayvaChat({
  open,
  onOpenChange,
  onReplyArrived,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Fires only when an answer lands while the panel is shut — long enough to have walked away. */
  onReplyArrived?: () => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [openSource, setOpenSource] = useState<number | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** The newest question only: a 15s answer must never land under a newer one. */
  const latestRef = useRef<string | null>(null);
  /* Nothing is written until the customer has actually said something. Under React's strict
     mode the persist effect runs on mount with an empty transcript, which — before the
     restored one had been committed — overwrote the stored chat with [] and the thread was
     gone on the next reload. */
  const dirtyRef = useRef(false);
  /* Read when the answer lands, which is ~15s after the request was made — the `open` prop
     captured by that request's closure is the value from then, so a panel closed while
     waiting would look open and never ping. */
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /* Restored rather than rebuilt: a chat that forgets the question you just asked feels
     broken, and the portal does remount on a hard reload. */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { turns?: ChatTurn[] };
      if (Array.isArray(parsed.turns) && parsed.turns.length > 0) {
        setTurns(parsed.turns.slice(-30));
        dirtyRef.current = true;
      }
    } catch {
      /* An unread transcript is not worth blocking the panel over. */
    }
  }, []);

  useEffect(() => {
    if (!dirtyRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ turns }));
    } catch {
      /* Private mode / quota — the chat still works for this page view. */
    }
  }, [turns]);

  useEffect(() => {
    if (!awaiting) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [awaiting]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns, awaiting, openSource, showAllSources]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question) return;

      const id = nextId();
      latestRef.current = id;
      dirtyRef.current = true;
      setOpenSource(null);
      setShowAllSources(false);
      setDraft('');
      setTurns(prev => [
        ...prev,
        { id: `${id}-q`, role: 'CUSTOMER', text: question },
      ]);
      setAwaiting(id);

      let reply: ChatTurn;
      try {
        const result = await knowledgeChatService.ask(question);
        const citations = Array.isArray(result.results) ? result.results : [];
        if (result.answerStatus === 'ANSWERED' && result.answer) {
          reply = { id, role: 'RAYVA', text: result.answer, citations };
        } else {
          /* A status this build doesn't know is shown as the service failing rather than as
             "nothing published covers that" — the second would be a claim about the bank's
             documents that the response didn't actually make. */
          const status =
            result.answerStatus === 'NOT_FOUND' ||
            result.answerStatus === 'INSUFFICIENT_EVIDENCE' ||
            result.answerStatus === 'FAILED'
              ? result.answerStatus
              : 'FAILED';
          reply = {
            id,
            role: 'RAYVA',
            text: UNRESOLVED_COPY[status],
            unresolved: status,
            /* The passages that were looked at are real text from a published document, so
               they stay useful when the answer step failed — shown as "closest published
               wording" rather than presented as an answer. */
            citations,
          };
        }
      } catch {
        reply = { id, role: 'RAYVA', text: UNRESOLVED_COPY.FAILED, unresolved: 'FAILED' };
      } finally {
        if (latestRef.current === id) setAwaiting(null);
      }
      if (latestRef.current !== id) return;
      setTurns(prev => [...prev, reply]);
      if (!openRef.current) onReplyArrived?.();
    },
    [onReplyArrived]
  );

  const last = turns[turns.length - 1];
  const lastCitations = last?.role === 'RAYVA' ? last.citations ?? [] : [];
  const started = turns.length > 0;

  function handleClear() {
    latestRef.current = null;
    setAwaiting(null);
    dirtyRef.current = true; // so the cleared thread stays cleared across a reload
    setTurns([]);
    setOpenSource(null);
    setShowAllSources(false);
  }

  return (
    <section
      id="rayva-chat"
      aria-label="Ask Rayva AI"
      aria-hidden={!open}
      data-open={open || undefined}
      className="rayva-panel glass-panel-solid"
    >
      {/* Presence header: what it is doing, in its voice. */}
      <header className="rayva-head">
        <span className="rayva-avatar" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
          <span className="rayva-live" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="serif text-lg font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
            Rayva
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {awaiting ? thinkingLine(seconds) : 'Answering from our published documents'}
          </p>
        </div>
        {started && (
          <button
            type="button"
            onClick={handleClear}
            className="ring-btn !h-8 !w-8"
            title="Start a new chat"
            aria-label="Start a new chat"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="ring-btn !h-8 !w-8"
          aria-label="Close Rayva"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div ref={bodyRef} className="rayva-body">
        {!started && (
          <div className="space-y-4">
            <div className="rayva-bubble">
              <p className="rayva-line">
                Hi — I&apos;m Rayva. I read the bank&apos;s own published paperwork so you don&apos;t have to.
              </p>
              <p className="rayva-line">
                Ask me about rates, a product, or what a step on your application means. I only say
                what&apos;s actually written down, and when I can&apos;t find something I&apos;ll tell you
                who can.
              </p>
            </div>
            <div>
              <p className="rayva-eyebrow">Try one of these</p>
              <div className="flex flex-wrap gap-2">
                {STARTER_QUESTIONS.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="chip text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div role="log" aria-live="polite" aria-relevant="additions text" className="space-y-3">
          {turns.map(turn => {
            if (turn.role === 'CUSTOMER') {
              return (
                <div key={turn.id} className="flex justify-end">
                  <p className="rayva-bubble-me">{turn.text}</p>
                </div>
              );
            }
            const citations = turn.citations ?? [];
            return (
              <div key={turn.id} className="space-y-2">
                <div
                  className={`rayva-bubble ${turn.unresolved === 'FAILED' ? 'rayva-bubble-warn' : ''}`}
                >
                  {/* AnswerBody passes text through untouched when it carries no [n] markers,
                      so the handoff lines above render the same way as a grounded answer. */}
                  <p className="rayva-line">
                    <AnswerBody
                      text={turn.text}
                      onCite={n => {
                        setOpenSource(n);
                        setShowAllSources(true);
                        requestAnimationFrame(() => {
                          document
                            .getElementById(`rayva-source-${n}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        });
                      }}
                    />
                  </p>
                </div>

                {turn.unresolved && (
                  <div className="rayva-handoff">
                    <p className="rayva-eyebrow">Instead, I can</p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/portal/messages" className="chip">
                        Message your relationship manager
                      </Link>
                      <Link href="/portal/products" className="chip">
                        Browse products
                      </Link>
                      <Link href="/portal/ai-assistant" className="chip">
                        Start an application
                      </Link>
                    </div>
                  </div>
                )}

                {!turn.unresolved && citations.length > 0 && (
                  <p className="rayva-grounded">
                    Grounded in {citations.length} published passage{citations.length === 1 ? '' : 's'} —
                    tap a number above to read it
                  </p>
                )}
              </div>
            );
          })}

          {awaiting && (
            <div className="flex items-start gap-2">
              <div className="rayva-bubble flex items-center gap-2">
                <span className="rayva-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">Rayva is thinking</span>
                {seconds >= 8 && (
                  <span className="num text-xs" style={{ color: 'var(--text-muted)' }}>
                    {seconds}s
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sources of the most recent reply. Kept below the thread so the answer stays the
            thing you read first. */}
        {lastCitations.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAllSources(v => !v)}
              aria-expanded={showAllSources}
              className="rayva-sources-toggle"
            >
              {showAllSources ? 'Hide' : 'Show'} the {lastCitations.length} passage
              {lastCitations.length === 1 ? '' : 's'} Rayva read
              <svg
                className="h-3.5 w-3.5 transition-transform"
                style={{ transform: showAllSources ? 'rotate(180deg)' : undefined }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAllSources && (
              <div className="mt-2 space-y-2">
                {lastCitations.map((c, i) => (
                  <CitationCard
                    key={c.chunkId ?? i}
                    index={i + 1}
                    citation={c}
                    open={openSource === i + 1}
                    onToggle={() => setOpenSource(openSource === i + 1 ? null : i + 1)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="rayva-composer"
        onSubmit={e => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="rayva-input">
          Ask Rayva a question
        </label>
        <input
          id="rayva-input"
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={500}
          autoComplete="off"
          placeholder={awaiting ? 'Ask another — I’ll get to it' : 'Ask about rates, a product, a step…'}
          className="input flex-1 rounded-full !py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send question to Rayva"
          className="btn btn-primary h-10 w-10 shrink-0 rounded-full !p-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
          </svg>
        </button>
      </form>
    </section>
  );
}
