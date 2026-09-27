'use client';
import { useAIPreferences, type AIPreferences as Preferences } from '@/lib/ai-preferences';

const options: { key: keyof Preferences; title: string; description: string }[] = [
  {
    key: 'insights',
    title: 'Spending insights',
    description: 'Show personalised summaries and spending patterns on your overview.',
  },
  {
    key: 'repeats',
    title: 'Repeat payment shortcuts',
    description: 'Use previous transfers to prepare payments and money requests.',
  },
  {
    key: 'documents',
    title: 'Document assistance',
    description: 'Offer bank statement and payslip extraction inside your application.',
  },
];
export function AIPreferencesPanel() {
  const { preferences, toggle, ready, storageError } = useAIPreferences();
  return (
    <section id="ai-preferences" className="panel scroll-mt-24 p-6">
      <h2 className="panel-title">Personalisation</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Choose the assistance you see. You can always bank and apply manually.
      </p>
      <div className="mt-4 divide-y divide-[var(--surface-border)]">
        {options.map(option => (
          <div key={option.key} className="flex items-center justify-between gap-5 py-4">
            <div>
              <h3 id={`label-${option.key}`} className="text-sm font-semibold">
                {option.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{option.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences[option.key]}
              aria-labelledby={`label-${option.key}`}
              disabled={!ready}
              onClick={() => toggle(option.key)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${preferences[option.key] ? 'bg-[var(--brand)]' : 'bg-slate-400'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${preferences[option.key] ? 'left-1 translate-x-5' : 'left-1'}`}
              />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--text-secondary)]" role="status">
        {storageError
          ? 'Your browser could not save this preference. It will reset when you leave this page.'
          : 'Saved for this profile in this browser. These controls change the interface; they do not change bank data-processing permissions.'}
      </p>
    </section>
  );
}
