'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { customerService, type Customer } from '@/services/api/customerService';
import {
  referenceDataService,
  type CustomerClassification,
  type TaxonomyNode,
} from '@/services/api/referenceDataService';
import { compactCurrency } from '@/lib/format';
import { SortableHeader, type SortConfig, handleSortToggle, sortData } from '@/components/SortableHeader';

/*
 * The customer register.
 *
 * The register is the bank's customer book, not a scoped RM portfolio: the customer
 * endpoint carries no bank identifier, so the page says so at the foot rather than
 * claiming ownership. Every summary figure is derived from the returned records; the
 * four compliance gaps (KYC, AML, risk rating and segmentation) drive the cover, the
 * metric strip and the quick filters. The list is paginated — 321 customers in one
 * table was 29,000px of page — and the segments/type/industry view is kept as a
 * second reading of the same book.
 */

type Tone = 'positive' | 'warning' | 'negative' | 'neutral' | 'accent';
type View = 'register' | 'segments';

const PAGE_SIZE = 25;

const TONE_COLOR: Record<Tone, string> = {
  positive: 'var(--rm-up)',
  warning: 'var(--rm-warn)',
  negative: 'var(--rm-down)',
  neutral: 'var(--rm-text-muted)',
  accent: 'var(--rm-brand)',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  CLEAR: 'Clear',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  NOT_STARTED: 'Not started',
  NOT_RATED: 'Not rated',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  MEDIUM: 'Medium',
  HIGH: 'High',
  POOR: 'Poor',
  BAD: 'Bad',
};

const RISK_RANK: Record<string, number> = {
  EXCELLENT: 0,
  GOOD: 1,
  FAIR: 2,
  MEDIUM: 3,
  HIGH: 4,
  POOR: 5,
  BAD: 6,
  NOT_RATED: 7,
};

const GLYPH = {
  plus: 'M12 4.5v15m7.5-7.5h-15',
  refresh:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  chevron: 'M9 5l7 7-7 7',
};

function Glyph({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function humanise(value?: string): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

function labelStatus(value?: string): string {
  if (!value) return 'No record';
  return STATUS_LABEL[value.toUpperCase()] ?? humanise(value);
}

function typeLabel(type?: string): string {
  if (!type) return '—';
  return customerService.formatCustomerType(type);
}

function segmentOf(c: Customer): string {
  return c.customerSegment?.trim() || 'Unsegmented';
}

function declaredIncomeOf(c: Customer): number {
  return c.annualRevenue ?? c.annualIncome ?? 0;
}

function kycTone(status?: string): Tone {
  const value = (status ?? '').toUpperCase();
  if (value === 'APPROVED') return 'positive';
  if (value === 'PENDING' || value === 'NOT_STARTED') return 'warning';
  if (value === 'REJECTED' || value === 'EXPIRED') return 'negative';
  return 'neutral';
}

function amlTone(status?: string): Tone {
  const value = (status ?? '').toUpperCase();
  if (value === 'CLEAR' || value === 'APPROVED') return 'positive';
  if (value === 'PENDING') return 'warning';
  if (value === 'REJECTED') return 'negative';
  return 'neutral';
}

function riskTone(rating?: string): Tone {
  const value = (rating ?? 'NOT_RATED').toUpperCase();
  if (value === 'EXCELLENT' || value === 'GOOD') return 'positive';
  if (value === 'FAIR' || value === 'MEDIUM') return 'warning';
  if (value === 'HIGH' || value === 'POOR' || value === 'BAD') return 'negative';
  return 'neutral';
}

function monthsSince(since?: string): number {
  if (!since) return 0;
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months > 0 ? months : 0;
}

function tenureLabel(months: number): string {
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return years > 0 ? `${years}y ${remainder}m` : `${remainder}m`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthYear(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase();
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {children}
    </span>
  );
}

function Bar({ pct, color = 'var(--rm-brand)' }: { pct: number; color?: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--rm-hairline-strong)' }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function Panel({
  title,
  note,
  children,
  foot,
  className = '',
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
  className?: string;
}) {
  const id = `customers-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section className={`rm-panel flex flex-col ${className}`} aria-labelledby={id}>
      <div className="rm-panel-head">
        <div className="min-w-0">
          <h2 id={id} className="rm-title">
            {title}
          </h2>
          {note && <p className="rm-sub">{note}</p>}
        </div>
      </div>
      <div className="rm-body flex-1">{children}</div>
      {foot && <div className="rm-foot">{foot}</div>}
    </section>
  );
}

type CustomerRow = Customer & {
  rowName: string;
  rowType: string;
  rowSegment: string;
  rowIndustry: string;
  rowIndustryCode: string;
  rowSector: string;
  rowBusinessType: string;
  rowIncome: number;
  rowTenureMonths: number;
  rowKyc: string;
  rowAml: string;
  rowRisk: string;
};

function pageWindow(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set<number>([0, count - 1, page, page - 1, page + 1]);
  const ordered = [...pages].filter(p => p >= 0 && p < count).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  ordered.forEach((p, i) => {
    if (i > 0 && p - ordered[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export default function CustomersPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [industries, setIndustries] = useState<TaxonomyNode[]>([]);
  const [classifications, setClassifications] = useState<CustomerClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [view, setView] = useState<View>('register');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [amlFilter, setAmlFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'rowName', direction: 'asc' });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customerService.getAllCustomers();
      setCustomers(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError('The customer register could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    referenceDataService
      .getIndustries()
      .then(setIndustries)
      .catch(err => console.error('Failed to load industry taxonomy:', err));
  }, []);

  useEffect(() => {
    if (!customers.length) return;
    referenceDataService
      .getPrimaryActivities(customers.map(c => c.customerId))
      .then(setClassifications)
      .catch(err => console.error('Failed to load customer classifications:', err));
  }, [customers]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, typeFilter, segmentFilter, kycFilter, amlFilter, riskFilter, industryFilter, sortConfig]);

  const classificationOf = useMemo(() => {
    const map = new Map<string, CustomerClassification>();
    classifications.forEach(classification => {
      if (classification.customerId) map.set(classification.customerId, classification);
    });
    return map;
  }, [classifications]);

  const industryNameOf = useCallback(
    (code?: string) => {
      if (!code) return '';
      return industries.find(industry => industry.code === code)?.name || code;
    },
    [industries]
  );

  const rows = useMemo<CustomerRow[]>(
    () =>
      customers.map(customer => {
        const classification = classificationOf.get(customer.customerId);
        const industryCode =
          customer.industryCode || classification?.industryCode || '';
        const industryName =
          industryNameOf(industryCode) || classification?.industryName || customer.industrySector || '—';
        return {
          ...customer,
          rowName: customerService.getCustomerName(customer),
          rowType: typeLabel(customer.customerType),
          rowSegment: segmentOf(customer),
          rowIndustry: industryName,
          rowIndustryCode: industryCode,
          rowSector: classification?.sectorName || classification?.sectorCode || '—',
          rowBusinessType:
            classification?.businessTypeName || classification?.businessTypeCode || '—',
          rowIncome: declaredIncomeOf(customer),
          rowTenureMonths: monthsSince(customer.customerSince),
          rowKyc: (customer.kycStatus || '').toUpperCase(),
          rowAml: (customer.amlCheckStatus || '').toUpperCase(),
          rowRisk: (customer.riskRating || 'NOT_RATED').toUpperCase(),
        };
      }),
    [customers, classificationOf, industryNameOf]
  );

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(rows.map(row => row.customerType))).filter(Boolean);
    return types.sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)));
  }, [rows]);

  const segmentOptions = useMemo(
    () => Array.from(new Set(rows.map(row => row.rowSegment))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const kycOptions = useMemo(
    () => Array.from(new Set(rows.map(row => row.rowKyc).filter(Boolean))).sort(),
    [rows]
  );

  const amlOptions = useMemo(
    () => Array.from(new Set(rows.map(row => row.rowAml).filter(Boolean))).sort(),
    [rows]
  );

  const riskOptions = useMemo(
    () =>
      Array.from(new Set(rows.map(row => row.rowRisk).filter(Boolean))).sort(
        (a, b) => (RISK_RANK[a] ?? 99) - (RISK_RANK[b] ?? 99)
      ),
    [rows]
  );

  const industryOptions = useMemo(() => {
    const codes = Array.from(
      new Set(rows.map(row => row.rowIndustryCode).filter(Boolean))
    ) as string[];
    return codes
      .map(code => ({ code, name: industryNameOf(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, industryNameOf]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = rows.filter(row => {
      if (term) {
        const haystack = [
          row.rowName,
          row.customerNumber,
          row.portalUsername,
          row.primaryEmail,
          row.primaryPhone,
          row.businessName,
          row.businessLegalName,
          row.rowIndustry,
          row.rowSector,
          row.rowSegment,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (typeFilter && row.customerType !== typeFilter) return false;
      if (segmentFilter && row.rowSegment !== segmentFilter) return false;
      if (kycFilter && row.rowKyc !== kycFilter) return false;
      if (amlFilter && row.rowAml !== amlFilter) return false;
      if (riskFilter && row.rowRisk !== riskFilter) return false;
      if (industryFilter && row.rowIndustryCode !== industryFilter) return false;
      return true;
    });
    return sortData(list, sortConfig);
  }, [
    rows,
    searchTerm,
    typeFilter,
    segmentFilter,
    kycFilter,
    amlFilter,
    riskFilter,
    industryFilter,
    sortConfig,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const metrics = useMemo(() => {
    const total = customers.length;
    const individual = rows.filter(row => row.customerType === 'INDIVIDUAL').length;
    const business = rows.filter(row => row.customerType !== 'INDIVIDUAL').length;
    const kycPending = rows.filter(row => row.rowKyc === 'PENDING').length;
    const amlPending = rows.filter(row => row.rowAml === 'PENDING').length;
    const notRated = rows.filter(row => row.rowRisk === 'NOT_RATED').length;
    const unsegmented = rows.filter(row => row.rowSegment === 'Unsegmented').length;
    const declared = rows.filter(row => row.rowIncome > 0).length;
    return {
      total,
      individual,
      business,
      kycPending,
      amlPending,
      notRated,
      unsegmented,
      declared,
      kycShare: total ? (kycPending / total) * 100 : 0,
      amlShare: total ? (amlPending / total) * 100 : 0,
      ratedShare: total ? (notRated / total) * 100 : 0,
      segmentShare: total ? (unsegmented / total) * 100 : 0,
    };
  }, [customers.length, rows]);

  const segmentMix = useMemo(() => {
    const map = new Map<string, { count: number; declared: number; declaredCount: number }>();
    rows.forEach(row => {
      const current = map.get(row.rowSegment) ?? { count: 0, declared: 0, declaredCount: 0 };
      current.count += 1;
      if (row.rowIncome > 0) {
        current.declared += row.rowIncome;
        current.declaredCount += 1;
      }
      map.set(row.rowSegment, current);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        ...value,
        share: metrics.total ? (value.count / metrics.total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows, metrics.total]);

  const typeMix = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(row => map.set(row.rowType, (map.get(row.rowType) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        share: metrics.total ? (count / metrics.total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows, metrics.total]);

  const industryMix = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    let unclassified = 0;
    rows
      .filter(row => row.customerType !== 'INDIVIDUAL')
      .forEach(row => {
        if (!row.rowIndustryCode) {
          unclassified += 1;
          return;
        }
        const current = map.get(row.rowIndustryCode) ?? {
          name: row.rowIndustry,
          count: 0,
        };
        current.count += 1;
        map.set(row.rowIndustryCode, current);
      });
    const entries = Array.from(map.entries())
      .map(([code, value]) => ({ code, ...value }))
      .sort((a, b) => b.count - a.count);
    return { entries, unclassified };
  }, [rows]);

  const recentlyAdded = useMemo(
    () =>
      [...rows]
        .filter(row => row.customerSince)
        .sort(
          (a, b) =>
            new Date(b.customerSince || 0).getTime() - new Date(a.customerSince || 0).getTime()
        )
        .slice(0, 4),
    [rows]
  );

  const hasFilters = !!(
    searchTerm ||
    typeFilter ||
    segmentFilter ||
    kycFilter ||
    amlFilter ||
    riskFilter ||
    industryFilter
  );

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setSegmentFilter('');
    setKycFilter('');
    setAmlFilter('');
    setRiskFilter('');
    setIndustryFilter('');
  };

  const scrollToRegister = () => {
    window.setTimeout(() => {
      document.getElementById('customer-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const quickFilter = (kind: 'kyc' | 'aml' | 'risk' | 'segment') => {
    setView('register');
    if (kind === 'kyc') setKycFilter(current => (current === 'PENDING' ? '' : 'PENDING'));
    if (kind === 'aml') setAmlFilter(current => (current === 'PENDING' ? '' : 'PENDING'));
    if (kind === 'risk') setRiskFilter(current => (current === 'NOT_RATED' ? '' : 'NOT_RATED'));
    if (kind === 'segment') {
      setSegmentFilter(current => (current === 'Unsegmented' ? '' : 'Unsegmented'));
    }
    scrollToRegister();
  };

  const drillSegment = (name: string) => {
    setSegmentFilter(name);
    setView('register');
    scrollToRegister();
  };

  const drillType = (type: string) => {
    const raw = rows.find(row => row.rowType === type)?.customerType;
    if (raw) setTypeFilter(raw);
    setView('register');
    scrollToRegister();
  };

  const drillIndustry = (code: string) => {
    setIndustryFilter(code);
    setView('register');
    scrollToRegister();
  };

  const handleSort = (field: string) => setSortConfig(current => handleSortToggle(field, current));

  const readings = useMemo(
    () => [
      {
        key: 'kyc' as const,
        title:
          metrics.kycShare >= 50
            ? 'Most customers await KYC.'
            : metrics.kycPending > 0
              ? 'A share of customers await KYC.'
              : 'KYC is clear across the register.',
      },
      {
        key: 'aml' as const,
        title:
          metrics.amlShare >= 50
            ? 'AML screening is outstanding for most.'
            : metrics.amlPending > 0
              ? 'A share of customers await AML screening.'
              : 'AML screening is clear across the register.',
      },
      {
        key: 'risk' as const,
        title:
          metrics.ratedShare >= 50
            ? 'Most records have no risk rating.'
            : metrics.notRated > 0
              ? 'A share of records have no risk rating.'
              : 'Every customer carries a risk rating.',
      },
      {
        key: 'segment' as const,
        title:
          metrics.segmentShare >= 50
            ? 'Over half have no segment.'
            : metrics.unsegmented > 0
              ? 'A share of customers have no segment.'
              : 'Every customer carries a segment.',
      },
    ],
    [metrics]
  );

  return (
    <div className="space-y-9 stagger-children" style={{ color: 'var(--rm-text)' }}>
      {/* ══ Toolbar ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
          Customer register
        </p>
        <button
          type="button"
          onClick={loadCustomers}
          disabled={loading}
          className="rounded-full p-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--rm-card)', color: 'var(--rm-text-muted)' }}
          title="Refresh the register"
          aria-label="Refresh the customer register"
        >
          <Glyph path={GLYPH.refresh} className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ══ Cover ══ */}
      <section
        className="rm-panel relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, color-mix(in srgb, var(--rm-brand) 12%, transparent), transparent 58%)',
        }}
        aria-label="Customer register position"
      >
        <div className="grid gap-10 p-7 sm:p-9 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="min-w-0">
            <h1
              className="serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
              style={{ color: 'var(--rm-text)' }}
            >
              Customers
            </h1>
            <p className="num mt-6 text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
              {loading && !customers.length ? (
                <span
                  className="block h-14 w-40 max-w-full rounded-2xl animate-pulse"
                  style={{ backgroundColor: 'var(--rm-input)' }}
                  aria-hidden="true"
                />
              ) : (
                metrics.total.toLocaleString()
              )}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              customers on the bank&rsquo;s register
              {customers.length > 0 && (
                <>
                  {' '}
                  · <span className="num">{metrics.individual.toLocaleString()}</span> individual ·{' '}
                  <span className="num">{metrics.business.toLocaleString()}</span> business
                </>
              )}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link href="/dashboard/customers/new" className="rm-btn rm-btn-solid">
                <Glyph path={GLYPH.plus} className="h-4 w-4" />
                Add customer
              </Link>
              <span
                className="rounded-full px-3.5 py-1.5 text-sm"
                style={{ backgroundColor: 'var(--rm-glass)', color: 'var(--rm-text-muted)' }}
              >
                <span className="num">{metrics.declared.toLocaleString()}</span> records with a declared
                annual figure
              </span>
            </div>
          </div>

          <div className="min-w-0 xl:border-l xl:pl-8" style={{ borderColor: 'var(--rm-hairline)' }}>
            <p className="serif text-lg font-medium" style={{ color: 'var(--rm-text)' }}>
              The reading
            </p>
            {metrics.total > 0 ? (
              <div className="mt-2">
                {readings.map((reading, index) => (
                  <button
                    key={reading.key}
                    type="button"
                    onClick={() =>
                      quickFilter(
                        reading.key === 'risk'
                          ? 'risk'
                          : reading.key === 'segment'
                            ? 'segment'
                            : reading.key
                      )
                    }
                    className="group flex w-full items-start gap-3 border-t py-3 text-left"
                    style={{ borderColor: 'var(--rm-hairline)' }}
                    aria-label={`Show the customers behind: ${reading.title}`}
                  >
                    <span className="num pt-0.5 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="flex-1 text-sm font-medium leading-snug"
                      style={{ color: 'var(--rm-text)' }}
                    >
                      {reading.title}
                    </span>
                    <Glyph
                      path={GLYPH.chevron}
                      className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                {loading ? 'Reading the register…' : 'No customer facts available.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ══ Compliance strip ══ */}
      <section className="rm-panel" aria-label="Customer compliance and segmentation">
        <div className="rm-strip">
          <button
            type="button"
            onClick={() => quickFilter('kyc')}
            aria-pressed={kycFilter === 'PENDING'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                kycFilter === 'PENDING'
                  ? 'color-mix(in srgb, var(--rm-warn) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Awaiting KYC</p>
              <p className="rm-strip-note">Of {metrics.total.toLocaleString()} on file</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-warn)' }}>
              {metrics.kycPending.toLocaleString()}
            </p>
          </button>

          <button
            type="button"
            onClick={() => quickFilter('aml')}
            aria-pressed={amlFilter === 'PENDING'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                amlFilter === 'PENDING'
                  ? 'color-mix(in srgb, var(--rm-warn) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Awaiting AML</p>
              <p className="rm-strip-note">Screening not yet clear</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-warn)' }}>
              {metrics.amlPending.toLocaleString()}
            </p>
          </button>

          <button
            type="button"
            onClick={() => quickFilter('risk')}
            aria-pressed={riskFilter === 'NOT_RATED'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                riskFilter === 'NOT_RATED'
                  ? 'color-mix(in srgb, var(--rm-warn) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Not risk-rated</p>
              <p className="rm-strip-note">No rating recorded</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-warn)' }}>
              {metrics.notRated.toLocaleString()}
            </p>
          </button>

          <button
            type="button"
            onClick={() => quickFilter('segment')}
            aria-pressed={segmentFilter === 'Unsegmented'}
            className="rm-strip-cell w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            style={{
              border: 0,
              backgroundColor:
                segmentFilter === 'Unsegmented'
                  ? 'color-mix(in srgb, var(--rm-brand) 10%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="min-w-0">
              <p className="rm-strip-label">Unsegmented</p>
              <p className="rm-strip-note">No segment assigned</p>
            </div>
            <p className="rm-strip-value num" style={{ color: 'var(--rm-brand)' }}>
              {metrics.unsegmented.toLocaleString()}
            </p>
          </button>
        </div>
      </section>

      {/* ══ Register / segments ══ */}
      <section id="customer-register" className="scroll-mt-6" aria-label="Customer register">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="num text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              01
            </p>
            <h2 className="serif mt-0.5 text-2xl font-medium" style={{ color: 'var(--rm-text)' }}>
              The register
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
              Search the book, or read it by segment, type and industry.
            </p>
          </div>
          <div
            className="flex rounded-full p-1"
            style={{ backgroundColor: 'var(--rm-glass)', border: '1px solid var(--rm-glass-border)' }}
            role="group"
            aria-label="Customer view"
          >
            {(
              [
                { key: 'register' as const, label: 'Register' },
                { key: 'segments' as const, label: 'Segments' },
              ]
            ).map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                aria-pressed={view === item.key}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={
                  view === item.key
                    ? { backgroundColor: 'var(--rm-brand)', color: '#fff' }
                    : { color: 'var(--rm-text-secondary)' }
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {view === 'register' ? (
          <Panel
            title="All customers"
            note={
              <>
                <span className="num">{filtered.length.toLocaleString()}</span> match the current view ·{' '}
                <span className="num">{customers.length.toLocaleString()}</span> on file
              </>
            }
            foot={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Showing{' '}
                  <span className="num">
                    {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
                    {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}
                  </span>{' '}
                  of <span className="num">{filtered.length.toLocaleString()}</span>
                  {filtered.length !== customers.length ? ' filtered' : ''}
                </span>
                {pageCount > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5" aria-label="Pagination">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="rm-btn rm-btn-quiet !px-3 !py-1.5"
                    >
                      Previous
                    </button>
                    {pageWindow(safePage, pageCount).map((item, index) =>
                      item === '…' ? (
                        <span key={`gap-${index}`} className="px-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          aria-current={item === safePage ? 'page' : undefined}
                          className="num h-8 min-w-8 rounded-full px-2 text-sm font-medium transition-colors"
                          style={
                            item === safePage
                              ? { backgroundColor: 'var(--rm-brand)', color: '#fff' }
                              : { color: 'var(--rm-text-secondary)' }
                          }
                        >
                          {item + 1}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                      disabled={safePage >= pageCount - 1}
                      className="rm-btn rm-btn-quiet !px-3 !py-1.5"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            }
          >
            {loading && !customers.length ? (
              <div className="space-y-3" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-2xl"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 py-6">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                    {error}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                    The reference data already loaded is kept; retry the register read.
                  </p>
                </div>
                <button type="button" onClick={loadCustomers} className="rm-btn rm-btn-solid">
                  Try again
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="block min-w-0 sm:col-span-2 xl:col-span-1">
                    <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      Search
                    </span>
                    <div className="relative mt-1.5">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--rm-text-muted)' }}
                        aria-hidden="true"
                      >
                        <Glyph path={GLYPH.search} className="h-4 w-4" />
                      </span>
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Name, login, email, number"
                        aria-label="Search customers"
                        className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm"
                        style={{
                          backgroundColor: 'var(--rm-input)',
                          color: 'var(--rm-text)',
                          border: '1px solid var(--rm-hairline-strong)',
                        }}
                      />
                    </div>
                  </label>

                  <FilterSelect label="Customer type" value={typeFilter} onChange={setTypeFilter}>
                    <option value="">All types</option>
                    {typeOptions.map(type => (
                      <option key={type} value={type}>
                        {typeLabel(type)}
                      </option>
                    ))}
                  </FilterSelect>

                  <FilterSelect label="Segment" value={segmentFilter} onChange={setSegmentFilter}>
                    <option value="">All segments</option>
                    {segmentOptions.map(segment => (
                      <option key={segment} value={segment}>
                        {segment}
                      </option>
                    ))}
                  </FilterSelect>

                  <FilterSelect label="KYC" value={kycFilter} onChange={setKycFilter}>
                    <option value="">All KYC states</option>
                    {kycOptions.map(status => (
                      <option key={status} value={status}>
                        {labelStatus(status)}
                      </option>
                    ))}
                  </FilterSelect>

                  <FilterSelect label="AML" value={amlFilter} onChange={setAmlFilter}>
                    <option value="">All AML states</option>
                    {amlOptions.map(status => (
                      <option key={status} value={status}>
                        {labelStatus(status)}
                      </option>
                    ))}
                  </FilterSelect>

                  <FilterSelect label="Risk rating" value={riskFilter} onChange={setRiskFilter}>
                    <option value="">All risk states</option>
                    {riskOptions.map(rating => (
                      <option key={rating} value={rating}>
                        {labelStatus(rating)}
                      </option>
                    ))}
                  </FilterSelect>

                  {industryOptions.length > 0 && (
                    <FilterSelect label="Industry" value={industryFilter} onChange={setIndustryFilter}>
                      <option value="">All industries</option>
                      {industryOptions.map(industry => (
                        <option key={industry.code} value={industry.code}>
                          {industry.name}
                        </option>
                      ))}
                    </FilterSelect>
                  )}
                </div>

                {hasFilters && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--rm-accent)' }}
                    >
                      Clear filters
                    </button>
                    <span className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                      <span className="num">{filtered.length.toLocaleString()}</span> of{' '}
                      <span className="num">{customers.length.toLocaleString()}</span> customers shown
                    </span>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                      {customers.length === 0 ? 'No customers yet.' : 'No customers match these filters.'}
                    </p>
                    {customers.length === 0 ? (
                      <Link
                        href="/dashboard/customers/new"
                        className="mt-3 inline-flex text-sm font-medium hover:underline"
                        style={{ color: 'var(--rm-accent)' }}
                      >
                        Add the first customer
                      </Link>
                    ) : hasFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-sm font-medium hover:underline"
                        style={{ color: 'var(--rm-accent)' }}
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <p className="mb-2 text-[13px] sm:hidden" style={{ color: 'var(--rm-text-muted)' }}>
                      Swipe the table for KYC, AML, risk and tenure.
                    </p>
                    <table className="rm-table w-full min-w-[900px] table-fixed border-collapse text-left">
                      <colgroup>
                        <col style={{ width: '26%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '3%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <SortableHeader
                            label="Customer"
                            field="rowName"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Type"
                            field="rowType"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Segment"
                            field="rowSegment"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="KYC"
                            field="rowKyc"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="AML"
                            field="rowAml"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Risk"
                            field="rowRisk"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Since"
                            field="rowTenureMonths"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <th className="w-10 px-2 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map(customer => (
                          <tr
                            key={customer.customerId}
                            tabIndex={0}
                            onClick={() => router.push(`/dashboard/customers/${customer.customerId}`)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                router.push(`/dashboard/customers/${customer.customerId}`);
                              }
                            }}
                            className="cursor-pointer"
                            title="Open the customer record"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                  style={{
                                    backgroundColor: 'var(--rm-brand-soft)',
                                    color: 'var(--rm-brand-on-soft)',
                                  }}
                                  aria-hidden="true"
                                >
                                  {initialsOf(customer.rowName)}
                                </span>
                                <div className="min-w-0">
                                  <Link
                                    href={`/dashboard/customers/${customer.customerId}`}
                                    onClick={event => event.stopPropagation()}
                                    className="serif block truncate text-sm font-medium hover:underline"
                                    style={{ color: 'var(--rm-text)' }}
                                  >
                                    {customer.rowName}
                                  </Link>
                                  <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                                    <span className="num">{customer.customerNumber || '—'}</span>
                                    {customer.portalUsername ? ` · @${customer.portalUsername}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                                {customer.rowType}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p
                                className="truncate text-sm"
                                style={{
                                  color:
                                    customer.rowSegment === 'Unsegmented'
                                      ? 'var(--rm-warn)'
                                      : 'var(--rm-text-secondary)',
                                }}
                                title={customer.rowSegment}
                              >
                                {customer.rowSegment}
                              </p>
                              <p
                                className="truncate text-xs"
                                style={{ color: 'var(--rm-text-muted)' }}
                                title={`${customer.rowIndustry}${customer.rowSector !== '—' ? ` · ${customer.rowSector}` : ''}${
                                  customer.rowBusinessType !== '—' ? ` · ${customer.rowBusinessType}` : ''
                                }`}
                              >
                                {customer.customerType === 'INDIVIDUAL'
                                  ? customer.occupation || 'Individual'
                                  : customer.rowIndustry}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone={kycTone(customer.rowKyc)}>{labelStatus(customer.rowKyc)}</Pill>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone={amlTone(customer.rowAml)}>{labelStatus(customer.rowAml)}</Pill>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone={riskTone(customer.rowRisk)}>{labelStatus(customer.rowRisk)}</Pill>
                            </td>
                            <td className="px-4 py-3">
                              <p
                                className="num text-sm"
                                style={{ color: 'var(--rm-text-secondary)' }}
                                title={formatDate(customer.customerSince)}
                              >
                                {formatMonthYear(customer.customerSince)}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                                {tenureLabel(customer.rowTenureMonths)}
                              </p>
                            </td>
                            <td className="px-2 py-3 text-right" style={{ color: 'var(--rm-text-muted)' }}>
                              <Glyph path={GLYPH.chevron} className="ml-auto h-4 w-4" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Panel>
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-12">
            <Panel
              title="By segment"
              note="Customer count and declared annual value, where recorded."
              className="min-w-0 xl:col-span-7"
              foot={
                <>
                  Declared annual revenue or income is shown only where the record carries a figure
                  (<span className="num">{metrics.declared.toLocaleString()}</span> of{' '}
                  <span className="num">{customers.length.toLocaleString()}</span> customers).
                </>
              }
            >
              <div>
                {segmentMix.map(segment => (
                  <button
                    key={segment.name}
                    type="button"
                    onClick={() => drillSegment(segment.name)}
                    className="flex w-full items-center gap-3 border-b py-2.5 text-left last:border-0"
                    style={{ borderColor: 'var(--rm-hairline)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        style={{
                          color:
                            segment.name === 'Unsegmented'
                              ? 'var(--rm-warn)'
                              : 'var(--rm-text)',
                        }}
                      >
                        {segment.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        <span className="num">{segment.count.toLocaleString()}</span> customers
                        {segment.declaredCount > 0
                          ? ` · ${segment.declaredCount} declared`
                          : ' · no declared value'}
                      </p>
                    </div>
                    <div className="w-20 shrink-0">
                      <Bar pct={segment.share} />
                    </div>
                    <p className="num w-8 shrink-0 text-right text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {segment.count.toLocaleString()}
                    </p>
                    <p className="num w-20 shrink-0 text-right text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {segment.declared > 0 ? compactCurrency(segment.declared) : '—'}
                    </p>
                    <Glyph path={GLYPH.chevron} className="h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>
            </Panel>

            <div className="min-w-0 space-y-5 xl:col-span-5">
            <Panel
              title="By customer type"
              note="The register splits into individual and business relationships."
            >
              <div>
                {typeMix.map(type => (
                  <button
                    key={type.name}
                    type="button"
                    onClick={() => drillType(type.name)}
                    className="flex w-full items-center gap-3 border-b py-3 text-left last:border-0"
                    style={{ borderColor: 'var(--rm-hairline)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                        {type.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        <span className="num">{type.count.toLocaleString()}</span> customers
                      </p>
                    </div>
                    <div className="w-24 shrink-0">
                      <Bar pct={type.share} />
                    </div>
                    <p className="num w-10 shrink-0 text-right text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                      {type.count.toLocaleString()}
                    </p>
                    <Glyph path={GLYPH.chevron} className="h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Customers with no segment are shown as Unsegmented in the register, not folded into
                their legal type.
              </p>
            </Panel>

            <Panel
              title="Recently onboarded"
              note="Newest relationships by customer-since date."
            >
              {recentlyAdded.length === 0 ? (
                <p className="py-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No customer-since dates are recorded.
                </p>
              ) : (
                <div>
                  {recentlyAdded.map(customer => (
                    <Link
                      key={customer.customerId}
                      href={`/dashboard/customers/${customer.customerId}`}
                      className="flex items-center gap-3 border-b py-3 last:border-0"
                      style={{ borderColor: 'var(--rm-hairline)' }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: 'var(--rm-brand-soft)',
                          color: 'var(--rm-brand-on-soft)',
                        }}
                        aria-hidden="true"
                      >
                        {initialsOf(customer.rowName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="serif truncate text-sm font-medium" style={{ color: 'var(--rm-text)' }}>
                          {customer.rowName}
                        </p>
                        <p className="truncate text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          <span className="num">{customer.customerNumber || '—'}</span> · {customer.rowType}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                          Onboarded
                        </p>
                        <p className="num text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {formatDate(customer.customerSince)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
            </div>

            <Panel
              title="Business by industry"
              note="Primary industry for business customers, where classified."
              className="min-w-0 xl:col-span-12"
              foot={
                industryMix.unclassified > 0 ? (
                  <>
                    <span className="num">{industryMix.unclassified.toLocaleString()}</span> business
                    customer{industryMix.unclassified === 1 ? ' has' : 's have'} no industry
                    classification.
                  </>
                ) : null
              }
            >
              {industryMix.entries.length === 0 ? (
                <p className="py-4 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                  No business customer carries an industry classification yet.
                </p>
              ) : (
                <div>
                  {industryMix.entries.slice(0, 6).map(industry => {
                    const businessTotal = Math.max(1, metrics.business - industryMix.unclassified);
                    return (
                      <button
                        key={industry.code}
                        type="button"
                        onClick={() => drillIndustry(industry.code)}
                        className="flex w-full items-center gap-3 border-b py-2.5 text-left last:border-0"
                        style={{ borderColor: 'var(--rm-hairline)' }}
                      >
                        <p className="min-w-0 flex-1 text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {industry.name}
                        </p>
                        <div className="w-24 shrink-0">
                          <Bar pct={(industry.count / businessTotal) * 100} color="var(--rm-brand-strong)" />
                        </div>
                        <p className="num w-8 shrink-0 text-right text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                          {industry.count.toLocaleString()}
                        </p>
                        <Glyph path={GLYPH.chevron} className="h-4 w-4 shrink-0" />
                      </button>
                    );
                  })}
                  {industryMix.entries.length > 6 && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                      and {industryMix.entries.length - 6} smaller industries.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}
      </section>

      <p className="pb-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        The customer service returns the register without a bank identifier, so this list is not
        filtered by bank. It is returned row by row: the same name can appear under different
        customer numbers. Reference data (industry, sector and business type) is read separately and
        may be incomplete.
        {lastUpdated && (
          <>
            {' '}
            · Last refreshed at{' '}
            <span className="num">
              {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm"
        style={{
          backgroundColor: 'var(--rm-input)',
          color: 'var(--rm-text)',
          border: '1px solid var(--rm-hairline-strong)',
        }}
      >
        {children}
      </select>
    </label>
  );
}
