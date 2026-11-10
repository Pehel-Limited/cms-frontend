'use client';

import { useCallback, useEffect, useState } from 'react';
import { ACCOUNTS, TRANSACTIONS, setActiveTransactions, type BankAccount, type Transaction } from '@/lib/banking-data';
import { accountService, type AccountSource, type SampleReason } from '@/services/api/account-service';
import { transactionService, type TransactionSource } from '@/services/api/transaction-service';
import { applicationService, type LoanApplication } from '@/services/api/application-service';
import { taskService, type CustomerTask } from '@/services/api/task-service';
import { cardService, type CustomerCard } from '@/services/api/card-service';
import { aiSignalsService, type CustomerSignal } from '@/services/api/ai-signals-service';

/* 92 days reaches back past the start of last month on any day of this one, which is what the
   month-to-date comparison and the recurring-payment detector both need. */
export const DASHBOARD_HISTORY_DAYS = 92;

export type Load<T> = { data: T; loading: boolean; failed: boolean };

const pending = <T,>(data: T): Load<T> => ({ data, loading: true, failed: false });
const settled = <T,>(data: T, failed = false): Load<T> => ({ data, loading: false, failed });

export interface DashboardMoney {
  accounts: BankAccount[];
  transactions: Transaction[];
  accountSource: AccountSource;
  sampleReason: SampleReason | null;
  txnSource: TransactionSource;
  /** Start of the window the history is complete from; null when the feed was truncated. */
  historyStart: Date | null;
}

/**
 * Loads the dashboard from the customer APIs that already exist — no new endpoints. Each source
 * settles on its own, so a slow card service never holds the balances back, and a failing one is
 * reported where it would have appeared rather than blanking the page.
 *
 * Accounts and statement lines move together: sample accounts beside a live statement (or the
 * reverse) would put two different customers on one screen.
 */
export function useDashboardData(insightsEnabled: boolean) {
  const [money, setMoney] = useState<Load<DashboardMoney>>(
    pending({
      accounts: ACCOUNTS,
      transactions: TRANSACTIONS,
      accountSource: 'SAMPLE',
      sampleReason: null,
      txnSource: 'SAMPLE',
      historyStart: null,
    })
  );
  const [apps, setApps] = useState<Load<LoanApplication[]>>(pending([]));
  const [tasks, setTasks] = useState<Load<CustomerTask[]>>(pending([]));
  const [cards, setCards] = useState<Load<CustomerCard[]>>(pending([]));
  const [signals, setSignals] = useState<CustomerSignal[]>([]);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const from = new Date(Date.now() - DASHBOARD_HISTORY_DAYS * 86_400_000);
    from.setHours(0, 0, 0, 0);

    (async () => {
      const acct = await accountService.getAccountsSnapshot();
      if (cancelled) return;
      const txn =
        acct.source === 'LIVE'
          ? await transactionService.getTransactionsSnapshot({ from: from.toISOString().slice(0, 10) })
          : { transactions: TRANSACTIONS, source: 'SAMPLE' as TransactionSource, truncated: false };
      if (cancelled) return;
      /* Other screens' helpers read the module's active set, so the dashboard publishes what it
         loaded the same way the previous overview did. */
      setActiveTransactions(txn.transactions);
      setMoney(
        settled({
          accounts: acct.accounts,
          transactions: txn.transactions,
          accountSource: acct.source,
          sampleReason: acct.sampleReason,
          txnSource: txn.source,
          historyStart: txn.source === 'LIVE' && !txn.truncated ? from : null,
        })
      );
    })().catch(() => {
      if (!cancelled) setMoney(m => settled(m.data, true));
    });

    applicationService
      .list(0, 100)
      .then(r => !cancelled && setApps(settled(r ?? [])))
      .catch(() => !cancelled && setApps(settled([], true)));
    taskService
      .listTasks()
      .then(r => !cancelled && setTasks(settled(r ?? [])))
      .catch(() => !cancelled && setTasks(settled([], true)));
    cardService
      .getCards()
      .then(r => !cancelled && setCards(settled(r)))
      .catch(() => !cancelled && setCards(settled([], true)));

    return () => {
      cancelled = true;
      setActiveTransactions(TRANSACTIONS);
    };
  }, [nonce]);

  useEffect(() => {
    let cancelled = false;
    setSignals([]);
    if (!insightsEnabled) return;
    aiSignalsService
      .getSignals()
      .then(s => !cancelled && setSignals(s.activeSignals || []))
      .catch(() => !cancelled && setSignals([]));
    return () => {
      cancelled = true;
    };
  }, [insightsEnabled, nonce]);

  return { money, apps, tasks, cards, signals, reload };
}
