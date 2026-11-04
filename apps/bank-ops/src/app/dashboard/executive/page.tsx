'use client';

import ExecutiveOverview from '@/components/dashboard/ExecutiveOverview';

/*
 * The executive view of the whole bank. The staff register that used to sit beside it is
 * still at /dashboard/admin/staff; the old /dashboard/admin URL redirects here.
 */
export default function ExecutivePage() {
  return <ExecutiveOverview />;
}
