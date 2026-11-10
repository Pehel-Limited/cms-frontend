'use client';

import { useEffect, useState } from 'react';
import { retailService } from '@/services/api/retail-service';

/** `null` while unknown, so entry points never flash and then disappear for business users. */
export function useRetailEligibility(): boolean | null {
  const [eligible, setEligible] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    retailService.eligibility().then(value => {
      if (!cancelled) setEligible(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return eligible;
}
