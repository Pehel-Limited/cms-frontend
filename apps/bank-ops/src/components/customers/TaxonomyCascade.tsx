'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  naceDisplay,
  referenceDataService,
  type TaxonomyNode,
} from '@/services/api/referenceDataService';

export interface ClassificationSelection {
  industryCode: string;
  sectorCode: string;
  businessTypeCode: string;
  /** Carried so a read-only view can label a selection before its lists have loaded. */
  industryName?: string;
  sectorName?: string;
  businessTypeName?: string;
  naceProposedCode?: string;
  naceOfficialTitle?: string;
  naceVerified?: boolean;
  naceRevision?: string;
  classificationStatus?: string;
  effectiveFrom?: string;
}

const EMPTY: ClassificationSelection = {
  industryCode: '',
  sectorCode: '',
  businessTypeCode: '',
};

const CONTROL = 'w-full rounded-xl px-4 py-2.5 text-sm';

function controlStyle(error?: string): React.CSSProperties {
  return {
    background: 'var(--rm-input)',
    border: `1px solid ${error ? 'rgba(239,68,68,0.6)' : 'var(--rm-border)'}`,
    color: 'var(--rm-text)',
  };
}

function SubLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm mb-1.5" style={{ color: 'var(--rm-text-secondary)' }}>
      {children}
    </label>
  );
}

/**
 * Cascaded Industry -> Sector -> Business Type -> suggested NACE selector.
 *
 * Levels are cleared downwards on change so a stale child of a previous parent can never
 * be submitted, and the server re-validates the hierarchy anyway. The NACE line is a
 * proposal from the master: when it has no verified official title the chip says so in
 * amber rather than supplying a label of its own.
 */
export function TaxonomyCascade({
  value,
  onChange,
  required,
  error,
}: {
  value: ClassificationSelection;
  onChange: (next: ClassificationSelection) => void;
  required?: boolean;
  error?: string;
}) {
  const uid = useId();
  const industryId = `${uid}-industry`;
  const sectorId = `${uid}-sector`;
  const typeId = `${uid}-type`;

  const [industries, setIndustries] = useState<TaxonomyNode[]>([]);
  const [sectors, setSectors] = useState<TaxonomyNode[]>([]);
  const [types, setTypes] = useState<TaxonomyNode[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    referenceDataService
      .getIndustries()
      .then(list => {
        if (alive) setIndustries(list);
      })
      .catch(() => {
        if (alive) setLoadError('Sector taxonomy unavailable');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!value.industryCode) {
      setSectors([]);
      return () => {
        alive = false;
      };
    }
    setLoadingSectors(true);
    referenceDataService
      .getSectors(value.industryCode)
      .then(list => {
        if (alive) setSectors(list);
      })
      .catch(() => {
        if (alive) setLoadError('Could not load sectors');
      })
      .finally(() => {
        if (alive) setLoadingSectors(false);
      });
    return () => {
      alive = false;
    };
  }, [value.industryCode]);

  // Requests are sequenced, not just cancelled: two searches typed quickly can answer out
  // of order, and the older answer must not overwrite the newer list.
  const typeSeq = useRef(0);

  useEffect(() => {
    if (!value.sectorCode) {
      typeSeq.current += 1;
      setTypes([]);
      return;
    }
    const seq = typeSeq.current + 1;
    typeSeq.current = seq;
    const term = query.trim();
    setLoadingTypes(true);
    // Debounced so typing filters without one request per keystroke.
    const t = setTimeout(() => {
      referenceDataService
        .getBusinessTypes(value.sectorCode, term || undefined)
        .then(list => {
          if (typeSeq.current === seq) setTypes(list);
        })
        .catch(() => {
          if (typeSeq.current === seq) setLoadError('Could not load business types');
        })
        .finally(() => {
          if (typeSeq.current === seq) setLoadingTypes(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [value.sectorCode, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // The result list changes as the analyst searches, so a selected code is not always
  // still present in it. Fall back to what the selection carries, otherwise the field
  // would appear to clear itself after a search.
  const selectedType = useMemo(
    () => types.find(t => t.code === value.businessTypeCode) ?? null,
    [types, value.businessTypeCode]
  );

  const selectedName = selectedType?.name || value.businessTypeName || '';

  const nace = value.businessTypeCode
    ? naceDisplay(
        selectedType
          ? {
              naceProposedCode: selectedType.naceProposedCode,
              naceOfficialTitle: selectedType.naceOfficialTitle,
              naceVerified: selectedType.naceVerified,
              naceRevision: selectedType.naceRevision,
            }
          : {
              naceProposedCode: value.naceProposedCode,
              naceOfficialTitle: value.naceOfficialTitle,
              naceVerified: value.naceVerified,
              naceRevision: value.naceRevision,
            }
      )
    : null;

  function handleIndustry(next: string) {
    onChange({ ...EMPTY, industryCode: next });
    setQuery('');
  }

  function handleSector(next: string) {
    onChange({
      ...EMPTY,
      industryCode: value.industryCode,
      sectorCode: next,
    });
    setQuery('');
  }

  function handleSelectType(node: TaxonomyNode) {
    onChange({
      industryCode: value.industryCode,
      sectorCode: value.sectorCode,
      businessTypeCode: node.code,
      businessTypeName: node.name,
      naceProposedCode: node.naceProposedCode,
      naceOfficialTitle: node.naceOfficialTitle,
      naceVerified: node.naceVerified,
    });
    setQuery('');
    setOpen(false);
  }

  function handleClearType() {
    onChange({ ...value, businessTypeCode: '', businessTypeName: undefined });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!value.sectorCode) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, types.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && activeIndex >= 0 && types[activeIndex]) {
      e.preventDefault();
      handleSelectType(types[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const riskSegment = sectors.find(s => s.code === value.sectorCode)?.indicativeRiskSegmentName;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <SubLabel htmlFor={industryId}>
            Industry{required && <span style={{ color: 'var(--rm-down)' }}> *</span>}
          </SubLabel>
          <select
            id={industryId}
            value={value.industryCode}
            onChange={e => handleIndustry(e.target.value)}
            className={CONTROL}
            style={controlStyle(error)}
          >
            <option value="">Select an industry</option>
            {industries.map(i => (
              <option key={i.code} value={i.code}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <SubLabel htmlFor={sectorId}>Sector</SubLabel>
          <select
            id={sectorId}
            value={value.sectorCode}
            disabled={!value.industryCode || loadingSectors}
            onChange={e => handleSector(e.target.value)}
            className={CONTROL}
            style={{ ...controlStyle(), opacity: value.industryCode ? 1 : 0.55 }}
          >
            <option value="">
              {value.industryCode ? (loadingSectors ? 'Loading…' : 'Select a sector') : 'Choose an industry first'}
            </option>
            {sectors.map(s => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          {riskSegment && (
            <p className="mt-1.5 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              Risk family: {riskSegment} — indicative only, not a rating
            </p>
          )}
        </div>
      </div>

      <div ref={comboRef} className="relative">
        <SubLabel htmlFor={typeId}>Business type</SubLabel>
        <input
          id={typeId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${uid}-listbox`}
          aria-autocomplete="list"
          type="text"
          disabled={!value.sectorCode}
          placeholder={
            value.sectorCode ? 'Search business types in this sector' : 'Choose a sector first'
          }
          value={open ? query : selectedName}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            if (!value.sectorCode) return;
            setQuery('');
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={CONTROL}
          style={{ ...controlStyle(), opacity: value.sectorCode ? 1 : 0.55 }}
        />
        {selectedType && !open && (
          <button
            type="button"
            onClick={handleClearType}
            className="absolute right-3 top-[2.6rem] text-xs underline-offset-2 hover:underline"
            style={{ color: 'var(--rm-text-muted)' }}
          >
            Clear
          </button>
        )}

        {open && value.sectorCode && (
          <div
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl p-1"
            style={{ background: 'var(--rm-card)', border: '1px solid var(--rm-border)' }}
          >
            {loadingTypes && (
              <p className="px-3 py-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                Searching…
              </p>
            )}
            {!loadingTypes && types.length === 0 && (
              <p className="px-3 py-2 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                No business type matches this sector yet. Leave it blank and record why in the
                note.
              </p>
            )}
            {!loadingTypes && (
              <ul id={`${uid}-listbox`} role="listbox" className="space-y-0.5">
                {types.map((t, idx) => (
                  <li key={t.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={t.code === value.businessTypeCode}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={e => {
                        e.preventDefault();
                        handleSelectType(t);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left"
                      style={{
                        background:
                          idx === activeIndex || t.code === value.businessTypeCode
                            ? 'var(--rm-input)'
                            : 'transparent',
                        color: 'var(--rm-text)',
                      }}
                    >
                      <span className="block text-sm">{t.name}</span>
                      <span className="block text-xs" style={{ color: 'var(--rm-text-muted)' }}>
                        {t.naceProposedCode
                          ? `Suggested NACE ${t.naceRevision ?? '2.1'} ${t.naceProposedCode}`
                          : 'No NACE proposed — review required'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {nace && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: nace.verified ? 'var(--rm-accent-muted)' : 'var(--rm-warn-soft)',
            border: '1px solid var(--rm-border)',
          }}
        >
          <p
            className="text-sm"
            style={{ color: nace.verified ? 'var(--rm-brand-on-soft)' : 'var(--rm-warn)' }}
          >
            {nace.label}
          </p>
          {!nace.verified && (
            <p className="mt-1 text-xs" style={{ color: 'var(--rm-text-muted)' }}>
              Proposed mapping, pending verification against the official NACE Rev. 2.1 list.
            </p>
          )}
        </div>
      )}

      {loadError && (
        <p className="text-sm" style={{ color: 'var(--rm-down)' }} role="alert">
          {loadError}
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: 'var(--rm-down)' }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Read-only classification, used on customer detail and inherited onto account views.
 * Absent classification is stated as a workflow state, never defaulted.
 */
const STATUS_LABELS: Record<string, string> = {
  REVIEW_REQUIRED: 'Awaiting analyst review',
  CLASSIFIED: 'Classified',
  UNCLASSIFIED: 'Unclassified',
  UNMAPPED_REVIEW: 'No NACE proposed — review required',
  PROPOSED_UNVERIFIED: 'Proposed, unverified',
  PREVIOUSLY_SOURCED_REVIEW: 'Previously sourced — needs review',
  ANALYST_OVERRIDE: 'Overridden by analyst',
};

const statusLabel = (v?: string) => (v ? STATUS_LABELS[v] || v : undefined);
export function ClassificationFacts({
  classification,
  columns = 3,
}: {
  classification?: ClassificationSelection | null;
  columns?: number;
}) {
  if (!classification?.industryCode) {
    return (
      <p className="text-sm" style={{ color: 'var(--rm-warn)' }}>
        Unclassified — needs an analyst to assign an industry
      </p>
    );
  }
  const c = classification;
  const nace = naceDisplay(c);
  const facts: { label: string; value?: string; tone?: 'warn' }[] = [
    { label: 'Industry', value: c.industryName || c.industryCode },
    { label: 'Sector', value: c.sectorName || c.sectorCode, tone: c.sectorName ? undefined : 'warn' },
    {
      label: 'Business type',
      value: c.businessTypeName || c.businessTypeCode,
      tone: c.businessTypeName ? undefined : 'warn',
    },
    { label: 'NACE', value: nace?.label, tone: nace && !nace.verified ? 'warn' : undefined },
    {
      label: 'Classification state',
      value: statusLabel(c.classificationStatus),
      tone: c.classificationStatus === 'REVIEW_REQUIRED' ? 'warn' : undefined,
    },
    { label: 'Effective from', value: c.effectiveFrom },
  ];

  return (
    <dl
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${Math.min(columns, 3)}, minmax(0, 1fr))` }}
    >
      {facts
        .filter(f => f.value)
        .map(f => (
          <div key={f.label}>
            <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--rm-text-muted)' }}>
              {f.label}
            </dt>
            <dd
              className="mt-1 text-sm"
              style={{ color: f.tone === 'warn' ? 'var(--rm-warn)' : 'var(--rm-text)' }}
            >
              {f.value}
            </dd>
          </div>
        ))}
    </dl>
  );
}
