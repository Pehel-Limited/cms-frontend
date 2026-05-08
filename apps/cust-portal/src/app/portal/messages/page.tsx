'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  messagingService,
  type Conversation,
  formatMessageTime,
} from '@/services/api/messaging-service';

/* ─── Skeleton ──────────────────────────────────────────────── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagingService
      .listConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Hero header ────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Messages</h1>
            <p className="mt-1 text-sm text-white/70">
              Conversations with your Relationship Manager, scoped to each application.
            </p>
          </div>
          {conversations.length > 0 && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
              <svg
                className="w-4 h-4 text-white/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-sm text-white font-medium tabular-nums">
                {conversations.length}
              </span>
              <span className="text-sm text-white/60">
                conversation{conversations.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-[#7f2b7b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No conversations yet</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Open an application and use the &quot;Messages&quot; panel to start a conversation with
            your RM.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map(conv => (
            <Link
              key={conv.id}
              href={`/portal/applications/${conv.applicationId}`}
              className="group block bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-[#7f2b7b]/30 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar icon */}
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f2b7b]/10 to-[#a0369b]/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-[#7f2b7b]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 group-hover:text-[#7f2b7b] transition-colors truncate">
                      {conv.subject || 'Application Messages'}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <svg
                          className="w-3.5 h-3.5 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                          />
                        </svg>
                        {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {conv.lastMessageAt && (
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatMessageTime(conv.lastMessageAt)}
                    </span>
                  )}
                  <svg
                    className="w-5 h-5 text-slate-300 group-hover:text-[#7f2b7b] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
