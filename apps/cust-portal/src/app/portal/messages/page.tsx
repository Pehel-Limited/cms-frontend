'use client';

import { useState } from 'react';

const CONVERSATIONS = [
  {
    id: '1',
    from: 'Support Team',
    initials: 'ST',
    gradient: 'linear-gradient(135deg,#7f2b7b,#ae3fa9)',
    subject: 'Account verification completed',
    preview: 'Your identity has been successfully verified. You now have full access...',
    time: '2h ago',
    unread: true,
    messages: [
      { sender: 'Support Team', text: 'Your identity has been successfully verified. You now have full access to all banking services. Welcome!', time: '10:32 AM', mine: false },
      { sender: 'You', text: 'Thank you! That was faster than expected.', time: '10:45 AM', mine: true },
    ],
  },
  {
    id: '2',
    from: 'James Carter',
    initials: 'JC',
    gradient: 'linear-gradient(135deg,#475569,#334155)',
    subject: 'Mortgage enquiry follow-up',
    preview: 'Hi Sarah, following up on our conversation about the mortgage in principle...',
    time: 'Yesterday',
    unread: false,
    messages: [
      { sender: 'James Carter', text: 'Hi Sarah, following up on our conversation about the mortgage in principle application. Do you need any help completing the documents?', time: 'Yesterday, 3:15 PM', mine: false },
      { sender: 'You', text: 'Yes please, I have a question about the income verification section.', time: 'Yesterday, 3:22 PM', mine: true },
      { sender: 'James Carter', text: 'Of course! You can upload your last 3 months of payslips or a P60. Just use the document upload section in your application.', time: 'Yesterday, 3:30 PM', mine: false },
    ],
  },
  {
    id: '3',
    from: 'Fraud Prevention',
    initials: 'FP',
    gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
    subject: 'Unusual activity detected',
    preview: 'We noticed a sign-in from a new device. Was this you?',
    time: '2 days ago',
    unread: false,
    messages: [
      { sender: 'Fraud Prevention', text: 'We noticed a sign-in from a new device (MacBook Pro, London). Was this you?', time: '2 days ago, 8:15 AM', mine: false },
      { sender: 'You', text: 'Yes, that was me. I just got a new laptop.', time: '2 days ago, 8:45 AM', mine: true },
      { sender: 'Fraud Prevention', text: 'Great, we have added this device to your trusted list. Stay safe!', time: '2 days ago, 9:00 AM', mine: false },
    ],
  },
];

const QUICK_HELP = [
  { icon: '💳', title: 'Card issues', desc: 'Report a lost, stolen or damaged card' },
  { icon: '🔒', title: 'Account locked', desc: 'Unlock your account or reset access' },
  { icon: '💸', title: 'Payment dispute', desc: 'Dispute a transaction or get a refund' },
  { icon: '📋', title: 'Account statement', desc: 'Request a printed or digital statement' },
];

export default function MessagesPage() {
  const [activeId, setActiveId] = useState<string | null>('1');
  const [draft, setDraft] = useState('');
  const active = CONVERSATIONS.find(c => c.id === activeId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Messages &amp; Support</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Get help or chat with your relationship manager.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#7f2b7b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5e1f5b]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New message
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: conversation list */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                placeholder="Search messages..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
              />
            </div>
          </div>

          <div className="divide-y" style={{ '--tw-divide-color': 'var(--surface-border)' } as React.CSSProperties}>
            {CONVERSATIONS.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className="w-full text-left px-4 py-3.5 transition-all"
                style={{
                  backgroundColor: activeId === conv.id ? 'rgba(127,43,123,0.08)' : undefined,
                  borderLeft: activeId === conv.id ? '3px solid #7f2b7b' : '3px solid transparent',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: conv.gradient }}>
                    {conv.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unread ? 'font-bold' : 'font-medium'}`} style={{ color: 'var(--text-primary)' }}>
                        {conv.from}
                      </p>
                      <span className="text-[10px] shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>{conv.time}</span>
                    </div>
                    <p className={`text-xs truncate ${conv.unread ? 'font-semibold' : ''}`} style={{ color: 'var(--text-secondary)' }}>{conv.subject}</p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{conv.preview}</p>
                  </div>
                  {conv.unread && <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-[#7f2b7b] mt-1" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: chat view */}
        <div className="lg:col-span-2 space-y-4">
          {active ? (
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)', minHeight: '500px' }}>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: active.gradient }}>
                  {active.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{active.from}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{active.subject}</p>
                </div>
                <button className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-input)' }}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {active.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-sm xl:max-w-md rounded-2xl px-4 py-3 ${msg.mine ? 'rounded-br-sm bg-[#7f2b7b] text-white' : 'rounded-bl-sm'}`}
                      style={!msg.mine ? { backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)' } : undefined}>
                      {!msg.mine && (
                        <p className="text-[10px] font-bold mb-1 text-[#7f2b7b] dark:text-purple-300">{msg.sender}</p>
                      )}
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <p className={`text-[10px] mt-1.5 ${msg.mine ? 'text-white/70' : ''}`}
                        style={!msg.mine ? { color: 'var(--text-muted)' } : undefined}>{msg.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="px-5 py-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <div className="flex items-center gap-3">
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7f2b7b]/40"
                    style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }}
                    onKeyDown={e => e.key === 'Enter' && setDraft('')}
                  />
                  <button
                    onClick={() => setDraft('')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors"
                    style={{ backgroundColor: draft.trim() ? '#7f2b7b' : 'var(--surface-input)' }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.13a.6.6 0 01.82-.73l16.5 8.05a.6.6 0 010 1.08l-16.5 8.06a.6.6 0 01-.82-.73L6 12zm0 0h6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl flex flex-col items-center justify-center py-20" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 text-3xl" style={{ backgroundColor: 'var(--surface-input)' }}>💬</div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Select a conversation</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Choose from the list to read messages</p>
            </div>
          )}

          {/* Quick help */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Quick help topics</h3>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_HELP.map(h => (
                <button key={h.title} className="flex items-start gap-3 p-3 rounded-xl text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" style={{ border: '1px solid var(--surface-border)' }}>
                  <span className="text-xl shrink-0">{h.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{h.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{h.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
