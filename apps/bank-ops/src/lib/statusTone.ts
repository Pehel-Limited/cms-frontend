/* Workflow status → colour, shared by the RM dashboard, its queue and the admin
   oversight table so the same status never means two colours on two screens.

   The palette is brand plus sentiment, not a hue per stage: seven near-identical
   statuses previously each carried their own arbitrary blue, indigo or violet,
   which asked the reader to memorise a legend that said nothing. Five tones, each
   with a meaning:

     up            done, won
     down          refused, withdrawn
     warn          waiting on a human decision
     brand         in flight, waiting on admin
     brand-strong  late stage, moving to close
*/

export interface StatusTone {
  bg: string;
  text: string;
  dot: string;
}

function tone(fg: string): StatusTone {
  return { bg: `color-mix(in srgb, ${fg} 14%, transparent)`, text: fg, dot: fg };
}

const COMPLETED = ['BOOKED', 'DISBURSED', 'ESIGN_COMPLETED', 'ACTIVE', 'CLOSED'];
const APPROVED = ['APPROVED', 'UNDERWRITING_APPROVED', 'CREDIT_APPROVED', 'KYC_APPROVED'];
const DECLINED = [
  'DECLINED',
  'KYC_REJECTED',
  'CREDIT_DECLINED',
  'UNDERWRITING_DECLINED',
  'OFFER_REJECTED',
  'OFFER_EXPIRED',
  'EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  'REJECTED',
];
const ATTENTION = [
  'PENDING_CREDIT_CHECK',
  'PENDING_UNDERWRITING',
  'IN_UNDERWRITING',
  'REFERRED_TO_SENIOR',
  'REFERRED_TO_UNDERWRITER',
];
const IN_FLIGHT = ['SUBMITTED', 'PENDING_KYC', 'PENDING_DOCUMENTS'];
const LATE = [
  'OFFER_GENERATED',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'PENDING_ESIGN',
  'PENDING_BOOKING',
  'BOOKING_IN_PROGRESS',
  'PENDING_DISBURSEMENT',
  'DISBURSEMENT_IN_PROGRESS',
];

const has = (list: string[], status: string) => list.includes(status);

export function statusTone(status: string): StatusTone {
  if (has(COMPLETED, status) || has(APPROVED, status)) return tone('var(--rm-up)');
  if (has(DECLINED, status)) return tone('var(--rm-down)');
  if (has(ATTENTION, status)) return tone('var(--rm-warn)');
  if (has(LATE, status)) return tone('var(--rm-brand-strong)');
  if (has(IN_FLIGHT, status)) return tone('var(--rm-brand)');
  return { bg: 'var(--rm-input)', text: 'var(--rm-text-secondary)', dot: 'var(--rm-text-muted)' };
}
