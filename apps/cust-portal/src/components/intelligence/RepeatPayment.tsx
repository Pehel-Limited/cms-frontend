'use client';
import { useEffect, useState } from 'react';
import { TRANSACTIONS, type Transaction } from '@/lib/banking-data';
import { useAIPreferences } from '@/lib/ai-preferences';

export function RepeatPayment({ onRepeat }: { onRepeat: (transaction: Transaction) => void }) {
  const { preferences, ready } = useAIPreferences();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [request, setRequest] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!ready || !preferences.repeats) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('repeat');
    if (!id) return;
    const mode = params.get('action') === 'request';
    const found = TRANSACTIONS.find(
      t =>
        t.id === id &&
        t.category === 'Transfers' &&
        t.status === 'COMPLETED' &&
        t.direction === (mode ? 'IN' : 'OUT')
    );
    if (!found) {
      setInvalid(true);
      return;
    }
    setTransaction(found);
    setRequest(mode);
    setAmount(String(found.amount));
    setNote(found.note || '');
    if (!mode) onRepeat(found);
  }, [onRepeat, ready, preferences.repeats]);
  if (invalid)
    return (
      <p role="alert" className="panel p-4 text-sm">
        This shortcut is no longer available. Choose a recipient below.
      </p>
    );
  if (!transaction || !ready || !preferences.repeats) return null;
  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(
        `Hi ${transaction!.merchant}, please send €${Number(amount).toFixed(2)}${note.trim() ? ` for ${note.trim()}` : ''}.`
      );
      setMessage(
        'Request text copied. Share it with your recipient using your preferred messaging app.'
      );
    } catch {
      setMessage('Clipboard unavailable. You can select and copy the request preview below.');
    }
  }
  return (
    <section className="panel p-6">
      <h2 className="panel-title">
        {request
          ? `Request from ${transaction.merchant}`
          : `Payment to ${transaction.merchant}`}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {request
          ? 'Edit the amount and reference, then copy the message to send.'
          : 'Recipient, amount and reference are prefilled from a previous transfer. Check them before continuing.'}
      </p>
      {request && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Amount (€)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                  setMessage('');
                }}
                className="input mt-2 block w-full"
              />
            </label>
            <label className="text-sm font-medium">
              What is it for?
              <input
                value={note}
                maxLength={140}
                onChange={e => {
                  setNote(e.target.value);
                  setMessage('');
                }}
                className="input mt-2 block w-full"
              />
            </label>
          </div>
          <p className="rounded-xl bg-[var(--surface-card)] p-4 text-sm">
            Hi {transaction.merchant}, please send €
            {Number(amount) > 0 ? Number(amount).toFixed(2) : '0.00'}
            {note.trim() ? ` for ${note.trim()}` : ''}.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!Number.isFinite(Number(amount)) || Number(amount) <= 0}
            onClick={copyRequest}
          >
            Copy request message
          </button>
          <p className="text-xs text-[var(--text-secondary)]">
            This prepares text only. It does not send a request, create a payment link or move
            money.
          </p>
          {message && (
            <p role="status" className="text-sm text-[var(--brand)]">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
