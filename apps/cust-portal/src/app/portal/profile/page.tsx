'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

const BENEFICIARIES_DATA = [
  { initials: 'JM', name: 'James Mitchell', bank: 'Barclays Bank', last4: '4589', gradient: 'linear-gradient(135deg,#7f2b7b,#ae3fa9)' },
  { initials: 'OM', name: 'Olivia Mitchell', bank: 'Lloyds Bank', last4: '7741', gradient: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { initials: 'EW', name: 'Emma Wilson', bank: 'HSBC UK', last4: '2298', gradient: 'linear-gradient(135deg,#8b5cf6,#6366f1)' },
];

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${on ? 'bg-[#7f2b7b]' : 'bg-slate-200 dark:bg-white/20'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
      <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const [notifications, setNotifications] = useState({
    email: true, sms: true, push: true, marketing: false,
    accountAlerts: true, securityAlerts: true, paymentConfirmations: true,
  });

  const toggle = (key: keyof typeof notifications) =>
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '??';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Profile &amp; Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage your personal details, security, preferences and support.</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Personal details */}
        <Section title="Personal details">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7f2b7b] to-[#ae3fa9] flex items-center justify-center text-white text-xl font-bold shadow-lg ring-4 ring-white/20">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {user?.firstName} {user?.lastName}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  Verified
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Customer ID: NBK-1245789</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { icon: '✉️', label: 'Email', value: user?.email ?? 'sarah.mitchell@email.com' },
              { icon: '📱', label: 'Mobile', value: '+44 7700 900123' },
              { icon: '📍', label: 'Address', value: '12 Maple Avenue, Richmond, London TW9 2QD' },
            ].map(row => (
              <div key={row.label} className="flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{row.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{row.label}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{row.value}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors w-full justify-center" style={{ border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit profile
          </button>
        </Section>

        {/* Identity & verification */}
        <Section title="Identity & verification">
          <div className="flex flex-col items-center py-3 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 mb-3">
              <svg className="h-7 w-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Your identity is verified</p>
            <p className="text-xs text-center mt-1" style={{ color: 'var(--text-muted)' }}>You have full access to all services.</p>
          </div>
          {[
            { label: 'Identity verification', status: 'Verified', ok: true },
            { label: 'Proof of address', status: 'Verified', ok: true },
            { label: 'ID document', status: 'Passport', ok: true },
            { label: 'Last verified', status: '24 May 2025', ok: null },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
              <span className={`text-xs font-semibold ${row.ok === true ? 'text-emerald-500' : ''}`}
                style={row.ok === null ? { color: 'var(--text-muted)' } : undefined}>
                {row.status}
                {row.ok === true && ' ●'}
              </span>
            </div>
          ))}
          <button className="mt-3 text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View verification details</button>
        </Section>

        {/* Security settings */}
        <Section title="Security settings">
          {[
            { label: 'Password', sub: 'Last changed 12 Mar 2025', action: 'Change' },
            { label: 'Biometric login', sub: 'Face ID enabled on this device', toggle: true, on: true },
            { label: 'Two-factor authentication', sub: 'Enabled', toggle: true, on: true },
            { label: 'Trusted devices', sub: '3 devices trusted', arrow: true },
            { label: 'Login history', sub: 'View recent activity', arrow: true },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.sub}</p>
              </div>
              {row.action && (
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0" style={{ border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  {row.action}
                </button>
              )}
              {row.toggle && <Toggle on={row.on ?? false} onChange={() => {}} />}
              {row.arrow && (
                <svg className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
          <button className="mt-2 text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">Manage all security settings →</button>
        </Section>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Beneficiaries */}
        <Section title="Beneficiaries & linked users">
          <div className="space-y-3 mb-4">
            {BENEFICIARIES_DATA.map(b => (
              <div key={b.name} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold shrink-0 shadow" style={{ background: b.gradient }}>
                  {b.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{b.bank} •••• {b.last4}</p>
                </div>
                <button className="px-3 py-1 rounded-lg text-xs font-semibold text-[#7f2b7b] dark:text-purple-300 shrink-0" style={{ border: '1px solid var(--surface-border)' }}>Pay</button>
              </div>
            ))}
          </div>
          <button className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Manage beneficiaries
          </button>
        </Section>

        {/* Notification settings */}
        <Section title="Notification settings">
          {[
            { key: 'accountAlerts', label: 'Account alerts', sub: 'Transactions, balance & account activity' },
            { key: 'securityAlerts', label: 'Security alerts', sub: 'Logins, password changes, suspicious activity' },
            { key: 'paymentConfirmations', label: 'Payment confirmations', sub: 'Payments, transfers, direct debits' },
          ].map(row => (
            <div key={row.key} className="flex items-start justify-between gap-3 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.sub}</p>
              </div>
              <Toggle on={notifications[row.key as keyof typeof notifications]} onChange={() => toggle(row.key as keyof typeof notifications)} />
            </div>
          ))}
          <button className="mt-2 text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">Manage notification settings →</button>
        </Section>

        {/* Communication preferences */}
        <Section title="Communication preferences">
          {[
            { key: 'email', label: 'Email notifications', sub: 'Account alerts, statements, offers' },
            { key: 'sms', label: 'SMS notifications', sub: 'Security alerts, OTP, account updates' },
            { key: 'push', label: 'Push notifications', sub: 'Instant alerts via mobile app' },
            { key: 'marketing', label: 'Marketing communications', sub: 'Product updates, offers and events' },
          ].map(row => (
            <div key={row.key} className="flex items-start justify-between gap-3 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.sub}</p>
              </div>
              <Toggle on={notifications[row.key as keyof typeof notifications]} onChange={() => toggle(row.key as keyof typeof notifications)} />
            </div>
          ))}
          <button className="mt-2 text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">Manage all preferences →</button>
        </Section>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Document center */}
        <Section title="Document center">
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Access and download your important documents.</p>
          <div className="grid grid-cols-2 gap-2">
            {['Statements', 'Tax documents', 'Account letters', 'Card documents'].map(doc => (
              <button key={doc} className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" style={{ border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                <svg className="h-4 w-4 shrink-0 text-[#7f2b7b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="truncate">{doc}</span>
                <svg className="h-3.5 w-3.5 ml-auto shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </Section>

        {/* Relationship manager */}
        <Section title="Relationship manager & support">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white font-bold shrink-0">
              JC
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>James Carter</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Relationship Manager</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-500 font-semibold">Online now</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[{ icon: '📞', text: '020 7946 0910' }, { icon: '✉️', text: 'james.carter@northbank.co.uk' }].map(c => (
              <div key={c.text} className="flex items-center gap-2">
                <span className="text-sm shrink-0">{c.icon}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.text}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button className="py-2 rounded-xl text-xs font-semibold text-[#7f2b7b] dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors" style={{ border: '1px solid var(--surface-border)' }}>
              Message
            </button>
            <button className="py-2 rounded-xl text-xs font-semibold transition-colors" style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
              Call
            </button>
          </div>
          <button className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-white bg-[#7f2b7b] hover:bg-[#6b2468] transition-colors">
            Contact support
          </button>
        </Section>

        {/* Privacy & data */}
        <Section title="Privacy & data">
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>You are in control of your data and privacy.</p>
          <div className="space-y-1">
            {['Privacy settings', 'Data sharing', 'Account visibility', 'Download my data', 'Delete account'].map((item, i) => (
              <button
                key={item}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                style={{ color: i === 4 ? '#ef4444' : 'var(--text-secondary)' }}
              >
                {item}
                <svg className="h-4 w-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
          <button className="mt-2 text-xs font-semibold text-[#7f2b7b] dark:text-purple-400">View privacy policy →</button>
        </Section>
      </div>
    </div>
  );
}
