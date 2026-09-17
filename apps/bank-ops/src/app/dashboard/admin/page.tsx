'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ─── mock data ─── */
const STATS = [
  { label: 'Active Users', value: 248, delta: '+12 vs last month', positive: true, icon: '👥', link: 'View users' },
  { label: 'Open Approval Rules', value: 32, delta: '+5 vs last month', positive: true, icon: '🔐', link: 'View rules' },
  { label: 'SLA Configurations', value: 18, delta: 'No change', positive: null, icon: '⏱️', link: 'View SLA' },
  { label: 'Integrations Healthy', value: '12 / 14', delta: '+1 vs last month', positive: true, icon: '🔗', link: 'View integrations' },
  { label: 'Recent Audit Events', value: 128, delta: '−8 vs last month', positive: false, icon: '📋', link: 'View audit logs' },
];

const ADMIN_TABS = ['User & Role Management', 'Workflow / SLA Configuration', 'Product & Policy Rules', 'Integrations', 'Audit Logs'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const USERS = [
  { name: 'Sarah Mitchell', email: 'sarah.mitchell@northbank.com', role: 'Underwriter', team: 'Corporate Banking', lastActive: '30 Apr 2025, 09:21 AM', status: 'Compliant' },
  { name: 'James Anderson', email: 'james.anderson@northbank.com', role: 'RM Manager', team: 'Corporate Banking', lastActive: '30 Apr 2025, 08:47 AM', status: 'Compliant' },
  { name: 'Priya Nair', email: 'priya.nair@northbank.com', role: 'Credit Analyst', team: 'Credit Risk', lastActive: '30 Apr 2025, 07:56 AM', status: 'Compliant' },
  { name: 'Michael Chen', email: 'michael.chen@northbank.com', role: 'Compliance Officer', team: 'Compliance', lastActive: '29 Apr 2025, 06:32 PM', status: 'Compliant' },
  { name: 'Daniel Fernandez', email: 'daniel.fernandez@northbank.com', role: 'Operations Manager', team: 'Operations', lastActive: '29 Apr 2025, 05:11 PM', status: 'Review' },
  { name: 'Neha Kapoor', email: 'neha.kapoor@northbank.com', role: 'Credit Analyst', team: 'Credit Risk', lastActive: '29 Apr 2025, 04:03 PM', status: 'Compliant' },
  { name: 'Benjamin Lee', email: 'benjamin.lee@northbank.com', role: 'System Administrator', team: 'Technology', lastActive: '29 Apr 2025, 02:18 PM', status: 'Compliant' },
  { name: 'Aisha Rahman', email: 'aisha.rahman@northbank.com', role: 'KYC Analyst', team: 'Compliance', lastActive: '29 Apr 2025, 11:41 AM', status: 'Review' },
];

const WORKFLOW_STEPS = [
  { step: 1, label: 'Credit Assessment', assignee: 'Credit Analyst', sla: '2h', color: '#0ea5e9' },
  { step: 2, label: 'Risk Review', assignee: 'Risk Manager', sla: '6h', color: '#8b5cf6' },
  { step: 3, label: 'Policy Check', assignee: 'Policy Engine', sla: '2h', color: '#10b981' },
  { step: 4, label: 'Underwriter Decision', assignee: 'Underwriter', sla: '8h', color: '#f59e0b' },
  { step: 5, label: 'Final Approval', assignee: 'RM Manager', sla: '2h', color: '#0ea5e9' },
];

const SYSTEM_HEALTH = [
  { name: 'Core Banking API', status: 'Healthy', uptime: '99.98%' },
  { name: 'Identity Service (SSO)', status: 'Healthy', uptime: '99.95%' },
  { name: 'Document Management', status: 'Healthy', uptime: '99.93%' },
  { name: 'Notification Service', status: 'Healthy', uptime: '99.97%' },
  { name: 'Policy Engine', status: 'Healthy', uptime: '99.92%' },
  { name: 'Reporting Service', status: 'Healthy', uptime: '99.96%' },
];

const RECENT_ADMIN_ACTIONS = [
  { action: 'Role updated: Credit Analyst', by: 'Sarah Mitchell', time: '30 Apr 2025, 09:15 AM', icon: '👤' },
  { action: 'Workflow updated: Corporate Loan Approval', by: 'Benjamin Lee', time: '30 Apr 2025, 08:42 AM', icon: '🔄' },
  { action: 'SLA policy updated: SME Loan', by: 'Sarah Mitchell', time: '29 Apr 2025, 07:28 AM', icon: '⏱️' },
  { action: 'User deactivated: John Davis', by: 'Benjamin Lee', time: '29 Apr 2025, 06:05 AM', icon: '🚫' },
];

const SECURITY_ALERTS = [
  { msg: 'Unusual login attempt detected', sub: 'admin@northbank.com', time: '30 Apr 2025, 09:12 AM', level: 'warn' },
  { msg: 'Privilege escalation attempt blocked', sub: 'user: priya.nair@northbank.com', time: '30 Apr 2025, 08:33 AM', level: 'error' },
];

function StatusBadge({ status }: { status: string }) {
  const isCompliant = status === 'Compliant';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isCompliant ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isCompliant ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {status}
    </span>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`} style={{ backgroundColor: 'var(--rm-card)', borderColor: 'var(--rm-border)' }}>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('User & Role Management');
  const [userSearch, setUserSearch] = useState('');
  const lastUpdated = '30 Apr 2025, 09:42 AM';

  const filteredUsers = USERS.filter(u =>
    userSearch === '' ||
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.team.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="text-sm mt-0.5 text-slate-400">Administrative control center for users, workflows, policies, integrations and system governance.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Last updated: {lastUpdated}</span>
          <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-slate-400 hover:text-slate-900">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {STATS.map(s => (
          <Card key={s.label} className="p-4 hover:border-cyan-500/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{s.icon}</span>
              <p className="text-xs text-slate-400 truncate">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className={`text-xs mt-1 font-medium ${s.positive === true ? 'text-emerald-400' : s.positive === false ? 'text-red-400' : 'text-slate-500'}`}>
              {s.delta}
            </p>
            <button className="mt-2 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              {s.link} →
            </button>
          </Card>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <Card>
        <div className="flex overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid var(--rm-border)' }}>
          {ADMIN_TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors relative"
              style={{
                color: activeTab === t ? '#0ea5e9' : '#64748b',
                borderBottom: activeTab === t ? '2px solid #0ea5e9' : '2px solid transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {activeTab === 'User & Role Management' && (
          <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-12">
            {/* Users table — 7 cols */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Users</h2>
                  <p className="text-xs text-slate-400">Manage users, roles, teams and access permissions.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search users..."
                      className="pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                      style={{ backgroundColor: 'var(--rm-input)', border: '1px solid var(--rm-border)' }}
                    />
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white/5 transition-colors border border-white/10">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filters
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add User
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--rm-border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      {['User', 'Role', 'Team', 'Last Active', 'Permissions Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={i} className="transition-colors hover:bg-white/[0.03]" style={{ borderBottom: '1px solid var(--rm-border)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}>
                              {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                              <p className="text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{u.role}</td>
                        <td className="px-4 py-3 text-slate-700">{u.team}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{u.lastActive}</td>
                        <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                        <td className="px-4 py-3">
                          <button className="p-1 rounded-lg hover:bg-white/5 transition-colors text-slate-500 hover:text-slate-900">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--rm-border)' }}>
                  <span className="text-xs text-slate-500">Showing 1 to {filteredUsers.length} of 248 users</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, '...', 31].map((p, i) => (
                      <button key={i} className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === 1 ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-900'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow panel — 3 cols */}
            <div className="xl:col-span-3 space-y-4">
              <div className="rounded-xl p-4" style={{ border: '1px solid var(--rm-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">Default Corporate Loan Approval</h3>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">Multi-stage workflow for corporate loan applications</p>
                <p className="text-xs font-semibold text-slate-400 mb-3">Approval Steps</p>
                <div className="space-y-2.5">
                  {WORKFLOW_STEPS.map(ws => (
                    <div key={ws.step} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold"
                        style={{ backgroundColor: ws.color + '25', color: ws.color, border: `1px solid ${ws.color}40` }}>
                        {ws.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">{ws.label}</p>
                        <p className="text-[10px] text-slate-500">{ws.assignee}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">SLA: {ws.sla}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rm-border)' }}>
                  <p className="text-xs font-semibold text-slate-400 mb-2">SLA Summary</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total SLA', value: '20h' },
                      { label: 'Elapsed (Avg)', value: '6h 24m' },
                      { label: 'SLA Met (30d)', value: '92%' },
                      { label: 'Breaches (30d)', value: '8', red: true },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg p-2" style={{ backgroundColor: 'var(--rm-input)' }}>
                        <p className="text-[10px] text-slate-500">{item.label}</p>
                        <p className={`text-sm font-bold ${item.red ? 'text-red-400' : 'text-slate-900'}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <button className="mt-3 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                    View full workflow →
                  </button>
                </div>
              </div>
            </div>

            {/* System health panel — 2 cols */}
            <div className="xl:col-span-2 space-y-4">
              {/* System health */}
              <div className="rounded-xl p-4" style={{ border: '1px solid var(--rm-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-900">System Health</h3>
                  <span className="text-[10px] text-emerald-400">All systems operational</span>
                </div>
                <div className="space-y-2">
                  {SYSTEM_HEALTH.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-[11px] text-slate-700 flex-1 truncate">{s.name}</span>
                      <span className="text-[10px] font-semibold text-emerald-400 shrink-0">{s.uptime}</span>
                    </div>
                  ))}
                </div>
                <button className="mt-3 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                  View all integrations →
                </button>
              </div>

              {/* Recent admin actions */}
              <div className="rounded-xl p-4" style={{ border: '1px solid var(--rm-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-900">Recent Admin Actions</h3>
                  <button className="text-[11px] text-cyan-400 hover:text-cyan-300">View all</button>
                </div>
                <div className="space-y-3">
                  {RECENT_ADMIN_ACTIONS.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">{a.icon}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-900 truncate">{a.action}</p>
                        <p className="text-[10px] text-slate-500">by {a.by}</p>
                        <p className="text-[10px] text-slate-600">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security alerts */}
              <div className="rounded-xl p-4" style={{ border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-bold text-slate-900">Security Alerts</h3>
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 rounded-full">{SECURITY_ALERTS.length}</span>
                </div>
                <div className="space-y-2.5">
                  {SECURITY_ALERTS.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <svg className="h-4 w-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-red-300">{a.msg}</p>
                        <p className="text-[10px] text-slate-500 truncate">{a.sub}</p>
                        <p className="text-[10px] text-slate-600">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="mt-2 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors">
                  View all alerts →
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'User & Role Management' && (
          <div className="p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ backgroundColor: 'var(--rm-input)' }}>
              <svg className="h-6 w-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900">{activeTab}</p>
            <p className="text-xs mt-1 text-slate-500">Configuration panel coming soon</p>
          </div>
        )}
      </Card>
    </div>
  );
}
