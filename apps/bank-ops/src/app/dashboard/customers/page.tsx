'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { customerService, type Customer } from '@/services/api/customerService';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';

/* ------------------------------------------------------------------ */
/* Derivation helpers (use real Customer fields, gracefully fallback)  */
/* ------------------------------------------------------------------ */

function exposureOf(c: Customer): number {
  return c.annualRevenue ?? c.annualIncome ?? c.netWorth ?? 0;
}

function isActive(c: Customer): boolean {
  return (c.customerStatus || '').toUpperCase() === 'ACTIVE';
}

function isAtRisk(c: Customer): boolean {
  const r = (c.riskRating || '').toUpperCase();
  return r === 'HIGH' || r === 'VERY_HIGH' || r === 'POOR' || r === 'BAD';
}

function needsReview(c: Customer): boolean {
  const k = (c.kycStatus || '').toUpperCase();
  return k === 'PENDING' || k === 'EXPIRED' || k === 'REJECTED';
}

function healthScore(c: Customer): number {
  if (typeof c.creditScore === 'number' && c.creditScore > 0) {
    if (c.creditScore > 100) {
      // Typical 300-850 credit-score range → normalise to 0-100
      return Math.round(Math.max(0, Math.min(100, ((c.creditScore - 300) / 550) * 100)));
    }
    return Math.round(Math.max(0, Math.min(100, c.creditScore)));
  }
  const map: Record<string, number> = { LOW: 84, MEDIUM: 66, HIGH: 46, VERY_HIGH: 30 };
  return map[(c.riskRating || '').toUpperCase()] ?? 72;
}

function healthBand(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: '#10b981' };
  if (score >= 70) return { label: 'Good', color: '#22c55e' };
  if (score >= 55) return { label: 'Fair', color: '#f59e0b' };
  return { label: 'At Risk', color: '#ef4444' };
}

function tenureOf(since?: string): { label: string; since: string } {
  if (!since) return { label: '—', since: '' };
  const start = new Date(since);
  if (isNaN(start.getTime())) return { label: '—', since: '' };
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const label = y > 0 ? `${y}y ${m}m` : `${m}m`;
  return { label, since: `Since ${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` };
}

function nextActionOf(c: Customer): string {
  const k = (c.kycStatus || '').toUpperCase();
  if (k === 'EXPIRED' || k === 'PENDING' || k === 'REJECTED') return 'KYC Update';
  if (isAtRisk(c)) return 'Risk Review';
  return 'Annual Review';
}

function segmentOf(c: Customer): string {
  if (c.customerSegment) return c.customerSegment;
  return customerService.formatCustomerType(c.customerType);
}

function industryOf(c: Customer): string {
  return c.industrySector || '—';
}

function compactCurrency(n: number): string {
  const sym = getCurrencySymbol();
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sym}${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}K`;
  return formatCurrency(n);
}

const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0ea5e9,#2563eb)',
  'linear-gradient(135deg,#8b5cf6,#6366f1)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#f97316)',
  'linear-gradient(135deg,#ec4899,#db2777)',
  'linear-gradient(135deg,#14b8a6,#0891b2)',
];
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/* ------------------------------------------------------------------ */
/* Circular health-score gauge                                         */
/* ------------------------------------------------------------------ */

function HealthGauge({ score }: { score: number }) {
  const band = healthBand(score);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-11 h-11 shrink-0">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5"
            style={{ stroke: 'var(--rm-border)' }} />
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
            stroke={band.color} strokeDasharray={`${dash} ${circ}`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
          style={{ color: 'var(--rm-text)' }}>{score}</span>
      </div>
      <span className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI stat card                                                       */
/* ------------------------------------------------------------------ */

function StatCard({
  label, value, sub, subColor, icon, tint,
}: {
  label: string; value: string; sub: string; subColor?: string;
  icon: React.ReactNode; tint: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--rm-text-muted)' }}>{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
          style={{ backgroundColor: `${tint}1a`, color: tint }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--rm-text)' }}>{value}</p>
      <p className="text-[11px] font-medium mt-1" style={{ color: subColor || 'var(--rm-text-muted)' }}>{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CustomersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'segments'>('list');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [sortBy, setSortBy] = useState<'exposure' | 'name' | 'health' | 'tenure'>('exposure');

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.searchCustomers({ searchTerm: '' });
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  /* Distinct filter values from real data */
  const segmentOptions = useMemo(
    () => Array.from(new Set(customers.map(segmentOf))).filter(Boolean).sort(),
    [customers]
  );
  const industryOptions = useMemo(
    () => Array.from(new Set(customers.map(c => c.industrySector).filter(Boolean) as string[])).sort(),
    [customers]
  );

  /* KPI metrics (derived from real data) */
  const metrics = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(isActive).length;
    const atRisk = customers.filter(isAtRisk).length;
    const reviews = customers.filter(needsReview).length;
    const exposure = customers.reduce((s, c) => s + exposureOf(c), 0);
    return { total, active, atRisk, reviews, exposure };
  }, [customers]);

  /* Filtering + sorting */
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = customers.filter(c => {
      if (term) {
        const name = customerService.getCustomerName(c).toLowerCase();
        const email = (c.primaryEmail || '').toLowerCase();
        const phone = (c.primaryPhone || '').toLowerCase();
        const num = (c.customerNumber || '').toLowerCase();
        if (!name.includes(term) && !email.includes(term) && !phone.includes(term) && !num.includes(term))
          return false;
      }
      if (segmentFilter && segmentOf(c) !== segmentFilter) return false;
      if (riskFilter && (c.riskRating || '').toUpperCase() !== riskFilter) return false;
      if (industryFilter && c.industrySector !== industryFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return customerService.getCustomerName(a).localeCompare(customerService.getCustomerName(b));
        case 'health':
          return healthScore(b) - healthScore(a);
        case 'tenure':
          return new Date(a.customerSince || 0).getTime() - new Date(b.customerSince || 0).getTime();
        case 'exposure':
        default:
          return exposureOf(b) - exposureOf(a);
      }
    });
    return list;
  }, [customers, searchTerm, segmentFilter, riskFilter, industryFilter, sortBy]);

  /* Segment breakdown for "Customer Segments" tab + sidebar */
  const segmentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; exposure: number }>();
    customers.forEach(c => {
      const key = segmentOf(c);
      const cur = map.get(key) || { count: 0, exposure: 0 };
      cur.count += 1;
      cur.exposure += exposureOf(c);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.exposure - a.exposure);
  }, [customers]);

  const recentlyAdded = useMemo(
    () =>
      [...customers]
        .filter(c => c.customerSince)
        .sort((a, b) => new Date(b.customerSince || 0).getTime() - new Date(a.customerSince || 0).getTime())
        .slice(0, 4),
    [customers]
  );

  const hasFilters = !!(searchTerm || segmentFilter || riskFilter || industryFilter);
  const clearFilters = () => {
    setSearchTerm('');
    setSegmentFilter('');
    setRiskFilter('');
    setIndustryFilter('');
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--rm-input)',
    color: 'var(--rm-text)',
    border: '1px solid var(--rm-border)',
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--rm-text)' }}>Customers</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--rm-text-secondary)' }}>
            Manage client relationships and drive growth
          </p>
        </div>
        <Link href="/dashboard/customers/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: '#0ea5e9' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </Link>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total Customers"
          value={metrics.total.toLocaleString()}
          sub="In portfolio"
          tint="#0ea5e9"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" /></svg>}
        />
        <StatCard
          label="Active Relationships"
          value={metrics.active.toLocaleString()}
          sub={metrics.total ? `${Math.round((metrics.active / metrics.total) * 100)}% of total customers` : '—'}
          subColor="#10b981"
          tint="#10b981"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
        />
        <StatCard
          label="At-Risk Customers"
          value={metrics.atRisk.toLocaleString()}
          sub="Need attention"
          subColor={metrics.atRisk ? '#ef4444' : undefined}
          tint="#ef4444"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
        />
        <StatCard
          label="Reviews Due"
          value={metrics.reviews.toLocaleString()}
          sub="KYC / periodic"
          tint="#8b5cf6"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
        <StatCard
          label="Total Exposure"
          value={compactCurrency(metrics.exposure)}
          sub="Portfolio value"
          subColor="#0ea5e9"
          tint="#14b8a6"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m-1 4h1m4-4h1m-1 4h1" /></svg>}
        />
      </div>

      {/* Main content + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Left column */}
        <div className="space-y-4 min-w-0">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                style={selectStyle}
              />
            </div>
            <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
              <option value="">All Segments</option>
              {segmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
              <option value="">All Risk</option>
              {RISK_OPTIONS.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
            {industryOptions.length > 0 && (
              <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" style={selectStyle}>
                <option value="">All Industries</option>
                {industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-semibold px-2" style={{ color: 'var(--rm-accent)' }}>
                Clear All
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--rm-border)' }}>
            {([['list', 'Customer List'], ['segments', 'Customer Segments']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className="px-4 py-2.5 text-sm font-semibold relative transition-colors"
                style={{ color: tab === key ? 'var(--rm-accent)' : 'var(--rm-text-muted)' }}>
                {label}
                {tab === key && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: 'var(--rm-accent)' }} />}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mx-auto mb-3" />
                <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>Loading customers...</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && customers.length === 0 && (
            <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3 text-3xl" style={{ backgroundColor: 'var(--rm-input)' }}>👥</div>
              <p className="font-semibold" style={{ color: 'var(--rm-text)' }}>No customers yet</p>
              <p className="text-sm mt-1 mb-4" style={{ color: 'var(--rm-text-muted)' }}>Get started by adding your first customer.</p>
              <Link href="/dashboard/customers/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#0ea5e9' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add First Customer
              </Link>
            </div>
          )}

          {/* Customer List tab */}
          {!loading && customers.length > 0 && tab === 'list' && (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-2" style={{ borderBottom: '1px solid var(--rm-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                  {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
                </span>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                  Sort by
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none" style={selectStyle}>
                    <option value="exposure">Total Exposure</option>
                    <option value="name">Name</option>
                    <option value="health">Health Score</option>
                    <option value="tenure">Relationship Tenure</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--rm-border)', backgroundColor: 'rgba(148,163,184,0.06)' }}>
                      {['Customer / Company', 'Segment', 'Industry', 'Total Exposure', 'Relationship Tenure', 'Health Score', 'Next Action', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--rm-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const name = customerService.getCustomerName(c);
                      const score = healthScore(c);
                      const ten = tenureOf(c.customerSince);
                      return (
                        <tr key={c.customerId} className="transition-colors hover:bg-white/[0.03] cursor-pointer" style={{ borderBottom: '1px solid var(--rm-border)' }}
                          onClick={() => router.push(`/dashboard/customers/${c.customerId}`)}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: avatarGradient(name) }}>
                                {name.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{name}</p>
                                <p className="text-[10px] font-mono truncate" style={{ color: 'var(--rm-text-muted)' }}>{c.customerNumber || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                              style={{ backgroundColor: c.customerType === 'INDIVIDUAL' ? 'rgba(14,165,233,0.14)' : 'rgba(139,92,246,0.14)', color: c.customerType === 'INDIVIDUAL' ? '#38bdf8' : '#a78bfa' }}>
                              {segmentOf(c)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--rm-text-secondary)' }}>{industryOf(c)}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>
                              {exposureOf(c) > 0 ? compactCurrency(exposureOf(c)) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-semibold" style={{ color: 'var(--rm-text)' }}>{ten.label}</p>
                            {ten.since && <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>{ten.since}</p>}
                          </td>
                          <td className="px-5 py-3.5"><HealthGauge score={score} /></td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}>
                              {nextActionOf(c)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <svg className="h-4 w-4 inline" style={{ color: 'var(--rm-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="py-14 text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--rm-text)' }}>No customers match your filters</p>
                  <button onClick={clearFilters} className="text-xs font-semibold mt-2" style={{ color: 'var(--rm-accent)' }}>Clear all filters</button>
                </div>
              )}
              <div className="px-5 py-3 text-xs" style={{ borderTop: '1px solid var(--rm-border)', color: 'var(--rm-text-muted)' }}>
                Showing {filtered.length} of {customers.length} customers
              </div>
            </div>
          )}

          {/* Customer Segments tab */}
          {!loading && customers.length > 0 && tab === 'segments' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {segmentBreakdown.map(seg => {
                const pct = metrics.total ? Math.round((seg.count / metrics.total) * 100) : 0;
                return (
                  <div key={seg.name} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold" style={{ color: 'var(--rm-text)' }}>{seg.name}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-muted)' }}>{seg.count}</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: 'var(--rm-text)' }}>{compactCurrency(seg.exposure)}</p>
                    <p className="text-[11px] mb-2" style={{ color: 'var(--rm-text-muted)' }}>Total exposure • {pct}% of portfolio</p>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--rm-input)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--rm-accent)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar — Relationship Insights (derived from real data) */}
        {!loading && customers.length > 0 && (
          <aside className="space-y-4">
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4" style={{ color: 'var(--rm-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                <h3 className="text-sm font-bold" style={{ color: 'var(--rm-text)' }}>Relationship Insights</h3>
              </div>
              <div className="space-y-2.5">
                <button onClick={() => setRiskFilter('HIGH')} className="w-full text-left rounded-xl p-3" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: '#f87171' }}>Churn Risk</span>
                    <span className="text-xs font-bold" style={{ color: '#f87171' }}>{metrics.atRisk}</span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--rm-text-muted)' }}>Customers flagged high/very-high risk. Act to retain value.</p>
                </button>
                <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>Reviews Due</span>
                    <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>{metrics.reviews}</span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--rm-text-muted)' }}>Pending KYC / periodic reviews to complete.</p>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: '#34d399' }}>Active Base</span>
                    <span className="text-xs font-bold" style={{ color: '#34d399' }}>{metrics.active}</span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--rm-text-muted)' }}>Healthy relationships driving portfolio value.</p>
                </div>
              </div>
            </div>

            {/* Portfolio by segment */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Portfolio by Segment</h3>
              <div className="space-y-2.5">
                {segmentBreakdown.slice(0, 5).map(seg => {
                  const pct = metrics.total ? Math.round((seg.count / metrics.total) * 100) : 0;
                  return (
                    <div key={seg.name}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold truncate" style={{ color: 'var(--rm-text-secondary)' }}>{seg.name}</span>
                        <span style={{ color: 'var(--rm-text-muted)' }}>{seg.count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--rm-input)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--rm-accent)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recently added */}
            {recentlyAdded.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--rm-text)' }}>Recently Onboarded</h3>
                <div className="space-y-3">
                  {recentlyAdded.map(c => {
                    const name = customerService.getCustomerName(c);
                    return (
                      <button key={c.customerId} onClick={() => router.push(`/dashboard/customers/${c.customerId}`)} className="flex items-center gap-3 w-full text-left">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: avatarGradient(name) }}>
                          {name.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--rm-text)' }}>{name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--rm-text-muted)' }}>{tenureOf(c.customerSince).since}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
