'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Glyph from '@/components/ui/Glyph';
import { MoneySheet, type MoneySheetMode } from '@/components/retail/MoneySheet';
import { useRetailEligibility } from '@/hooks/useRetailEligibility';
import { retailService } from '@/services/api/retail-service';

function MicIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** Entry point shown on the payments page for retail customers only. */
export function RetailConnectsPanel() {
  const eligible = useRetailEligibility();
  const [sheetMode, setSheetMode] = useState<MoneySheetMode | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (eligible !== true) return;
    retailService
      .requestSummary()
      .then(summary => setPending(summary.pendingReceived))
      .catch(() => undefined);
  }, [eligible, sheetMode]);

  if (eligible !== true) return null;

  return (
    <section className="glass-panel" aria-label="Connects" data-testid="retail-connects-panel">
      <div className="glass-head">
        <div>
          <h2 className="glass-title">Connects</h2>
          <p className="glass-sub">Say it or type it: “Send €10 to John Payne for badminton”.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-5">
        <button type="button" className="pill-btn pill-btn-solid" onClick={() => setSheetMode('send')} data-testid="open-send">
          <MicIcon />
          Send money
        </button>
        <button type="button" className="pill-btn" onClick={() => setSheetMode('request')} data-testid="open-request">
          <Glyph name="plus" className="h-4 w-4" />
          Request money
        </button>
        <Link href="/portal/payments/connects" className="pill-btn">
          Connects
        </Link>
        <Link href="/portal/payments/requests" className="pill-btn" data-testid="link-requests">
          Requests
          {pending > 0 && (
            <span className="chip num ml-1" data-testid="pending-badge">
              {pending}
            </span>
          )}
        </Link>
      </div>
      <MoneySheet open={sheetMode !== null} mode={sheetMode ?? 'send'} onClose={() => setSheetMode(null)} />
    </section>
  );
}
