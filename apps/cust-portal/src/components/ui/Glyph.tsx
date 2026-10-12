'use client';

/* Monochrome outline glyphs.

   Emojis render differently per platform and OS, cannot be recoloured to sit in
   the theme, and read as a consumer toy rather than a bank — so the banking
   screens draw every avatar from this set instead. Each glyph is one complete
   24x24 stroked path that inherits `currentColor`, taking whatever colour the
   surrounding token sets. Path data is the Heroicons v2 outline form already used
   elsewhere in the app, one `d` string per glyph, no fragments, no runtime
   splitting. */

const PATHS: Record<string, string> = {
  /* Accounts */
  current:
    'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  savings:
    'M12 3v2.25m6.36.36l-1.591 1.591M21 12h-2.25m-.36 6.36l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  vault:
    'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  joint:
    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',

  /* Spend categories */
  Groceries:
    'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
  'Eating out':
    'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.164C6.845 8.596 6.18 9.71 6.18 10.825v1.5c0 1.114.664 2.229 1.796 2.41 1.327.109 2.67.165 4.024.165m0-6.75c1.355 0 2.697.056 4.024.164 1.132.181 1.796 1.296 1.796 2.41v1.5c0 1.114-.664 2.229-1.796 2.41-1.327.109-2.67.165-4.024.165m0 0v6m0-6c-.621 0-1.235-.02-1.841-.061M12 21v-3.75',
  Transport:
    'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m15 0h.153c.122 0 .24.017.352.05l1.779.594a.75.75 0 01.516.71v1.021a1.125 1.125 0 01-1.125 1.125H18.75m-1.5-4.5V6.75a2.25 2.25 0 00-2.25-2.25H9a2.25 2.25 0 00-2.25 2.25v7.5m12 0v-3.375c0-.621-.504-1.125-1.125-1.125h-9.75a1.125 1.125 0 00-1.125 1.125v3.375M4.5 18.75h-.75',
  Shopping:
    'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  Bills:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  Entertainment:
    'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.624.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.624-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0 0h-1.5m1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5m1.5-2.625c.621 0 1.125.504 1.125 1.125v1.5m0 0h1.5m-1.5 0h-1.5',
  Health:
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  Travel:
    'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  Income:
    'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  Transfers:
    'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  Cash:
    'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  Other:
    'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',

  /* Scheduled payments */
  energy: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  subscription:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  rent:
    'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  health:
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',

  /* Documents and general UI */
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  bank: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6v3H3V9zM3 21h18',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z',
  shield:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  sign: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  chart:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  send: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  check: 'M4.5 12.75l6 6 9-13.5',
  x: 'M6 18L18 6M6 6l12 12',
  chevron: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
  swap: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  clock: 'M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z',
  alert: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',

  /* Card controls */
  globe:
    'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9',
  contactless: 'M8.5 8.5a5 5 0 010 7M11.5 6a8 8 0 010 12M5.5 11a2 2 0 010 2',
  snowflake: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
};

/** Account type → glyph name. */
export const ACCOUNT_GLYPH: Record<string, string> = {
  CURRENT: 'current',
  SAVINGS: 'savings',
  VAULT: 'vault',
  JOINT: 'joint',
};

/** Document category → glyph name; resolved through `glyphFor`. */
const DOC_GLYPH: Record<string, string> = {
  IDENTITY: 'user',
  ADDRESS_PROOF: 'rent',
  INCOME_PROOF: 'Income',
  BANK_STATEMENT: 'bank',
  TAX_RETURN: 'Bills',
  EMPLOYMENT_LETTER: 'doc',
  BUSINESS_REGISTRATION: 'bank',
  FINANCIAL_STATEMENT: 'chart',
  COLLATERAL: 'vault',
  INSURANCE: 'shield',
  LEGAL: 'doc',
  SIGNED_AGREEMENT: 'sign',
  OTHER: 'doc',
};

/* Resolves a spend category, document category or glyph name to a key in PATHS.
   Feed values arrive as `SpendCategory` strings, `DocumentCategory` codes or the
   `icon` names the sample data carries; anything unrecognised falls back to
   `Other` rather than rendering a hole. */
export function glyphFor(value?: string): string {
  if (!value) return 'Other';
  if (PATHS[value]) return value;
  const upper = value.toUpperCase();
  return PATHS[upper] ? upper : DOC_GLYPH[upper] || 'Other';
}

export default function Glyph({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.6,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || PATHS.Other} />
    </svg>
  );
}

/* The avatar tile a glyph sits in. Neutral by design: a token-painted surface,
   a hairline edge and `currentColor` strokes, so the same tile works in the
   light and the dark theme without a category colour bolted onto it. */
export function GlyphTile({
  name,
  className = 'h-10 w-10 rounded-xl',
  iconClassName = 'h-5 w-5',
  tone = 'neutral',
  strokeWidth,
}: {
  name: string;
  className?: string;
  iconClassName?: string;
  tone?: 'neutral' | 'brand';
  strokeWidth?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={
        tone === 'brand'
          ? {
              backgroundColor: 'var(--brand-soft)',
              color: 'var(--brand-on-soft)',
              border: '1px solid var(--hairline)',
            }
          : {
              backgroundColor: 'var(--tile-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--hairline)',
            }
      }
    >
      <Glyph name={name} className={iconClassName} strokeWidth={strokeWidth} />
    </span>
  );
}
