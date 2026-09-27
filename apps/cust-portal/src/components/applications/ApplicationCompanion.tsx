'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CustomerStage, CustomerStatusInfo, LoanApplication } from '@/services/api/application-service';
import { documentService, type DocumentSummary } from '@/services/api/document-service';
import { offerService, type OfferWithConditions } from '@/services/api/offer-service';
import {
  TASK_TYPE_LABELS,
  dueDateLabel,
  isOverdue,
  isPending,
  taskService,
  type CustomerTask,
  type TaskType,
} from '@/services/api/task-service';

/**
 * One persistent checklist for an application: what is done, what is missing,
 * why each item matters, and whose turn it is.
 *
 * Every row is derived from something the backend actually said — the
 * application record, the document summary, or a task. Where a source could not
 * be read the item is simply absent rather than guessed, so this panel can never
 * claim a step is complete that nobody confirmed.
 */

type Actor = 'YOU' | 'BANK' | 'UNSPECIFIED';
type ItemState = 'DONE' | 'OUTSTANDING' | 'IN_PROGRESS';

interface CompanionItem {
  id: string;
  label: string;
  state: ItemState;
  /** Why this step exists — the consequence of it being missing. */
  why: string;
  actor: Actor;
  href?: string;
  actionLabel?: string;
  note?: string;
}

/** Task types only the customer can clear. */
const CUSTOMER_TASK_TYPES = new Set<TaskType>([
  'PROVIDE_KYC_DOCUMENTS',
  'UPLOAD_DOCUMENT',
  'FIX_APPLICATION_FIELDS',
  'ACCEPT_OFFER',
  'SIGN_AGREEMENT',
  'REQUEST_MISSING_INFO',
]);

/** Task types the bank works through itself. */
const BANK_TASK_TYPES = new Set<TaskType>(['DOCUMENT_REVIEW', 'COMPLIANCE_REVIEW']);

const ACTOR_LABEL: Record<Actor, string> = {
  YOU: 'Your action',
  BANK: 'Bank is acting',
  UNSPECIFIED: 'No action needed',
};

const STATE_LABEL: Record<ItemState, string> = {
  DONE: 'Complete',
  OUTSTANDING: 'Outstanding',
  IN_PROGRESS: 'In progress',
};

const STATE_TONE: Record<ItemState, string> = {
  DONE: 'text-emerald-600 dark:text-emerald-400',
  OUTSTANDING: 'text-amber-600 dark:text-amber-400',
  IN_PROGRESS: 'text-blue-600 dark:text-blue-400',
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });

const STAGE_ITEM: Partial<Record<CustomerStage, Omit<CompanionItem, 'id'>>> = {
  VERIFICATION: {
    label: 'Verification',
    state: 'IN_PROGRESS',
    actor: 'BANK',
    why: 'The bank is confirming your identity and the details you supplied.',
  },
  UNDER_REVIEW: {
    label: 'Credit assessment',
    state: 'IN_PROGRESS',
    actor: 'BANK',
    why: 'This is where the lending decision is made. The bank reviews your application and evidence against its own criteria.',
  },
  OFFER: {
    label: 'Review your offer',
    state: 'OUTSTANDING',
    actor: 'YOU',
    why: 'An offer has been made. Nothing happens until you accept or decline it, and offers can expire.',
  },
  SIGNING: {
    label: 'Sign the agreement',
    state: 'OUTSTANDING',
    actor: 'YOU',
    why: 'Funds cannot be released until every signer has signed.',
  },
  BOOKING: {
    label: 'Funding and account opening',
    state: 'IN_PROGRESS',
    actor: 'BANK',
    why: 'The bank is opening the loan account and arranging release of the funds.',
  },
  COMPLETED: {
    label: 'Application complete',
    state: 'DONE',
    actor: 'UNSPECIFIED',
    why: 'This application has finished. Nothing further is needed from you.',
  },
};

function buildItems(
  application: LoanApplication,
  statusInfo: CustomerStatusInfo | null,
  tasks: CustomerTask[] | null,
  summary: DocumentSummary | null,
  offer: OfferWithConditions | null
): CompanionItem[] {
  const items: CompanionItem[] = [];
  const id = application.applicationId;
  const isDraft = application.status === 'DRAFT';

  items.push(
    isDraft
      ? {
          id: 'submit',
          label: 'Submit your application',
          state: 'OUTSTANDING',
          actor: 'YOU',
          why: 'Nothing reaches the bank until you submit. Your draft is saved and you can return to it at any point.',
          href: `/portal/applications/new?product=&resume=${id}`,
          actionLabel: 'Continue your draft',
        }
      : {
          id: 'submit',
          label: 'Application submitted',
          state: 'DONE',
          actor: 'UNSPECIFIED',
          why: 'The bank holds your application and can begin assessing it.',
          note: application.submittedAt ? `Submitted ${shortDate(application.submittedAt)}` : undefined,
        }
  );

  if (summary) {
    if (summary.totalRequiredRequests === 0) {
      items.push({
        id: 'documents',
        label: 'No documents requested yet',
        state: 'DONE',
        actor: 'UNSPECIFIED',
        why: 'The bank has not asked for evidence. It may request more as the assessment progresses.',
      });
    } else if (summary.allRequiredFulfilled) {
      items.push({
        id: 'documents',
        label: `All ${summary.totalRequiredRequests} required documents supplied`,
        state: 'DONE',
        actor: 'UNSPECIFIED',
        why: 'Assessment cannot begin while required evidence is missing. Yours is complete.',
        note: `${summary.totalDocuments} document${summary.totalDocuments === 1 ? '' : 's'} on file`,
      });
    } else {
      items.push({
        id: 'documents',
        label: `${summary.pendingRequiredRequests} required document${
          summary.pendingRequiredRequests === 1 ? '' : 's'
        } outstanding`,
        state: 'OUTSTANDING',
        actor: 'YOU',
        why: 'The bank cannot complete its assessment while required evidence is missing.',
        note: `${summary.totalRequiredRequests - summary.pendingRequiredRequests} of ${summary.totalRequiredRequests} supplied`,
      });
    }
  }

  if (application.kycCompleted != null) {
    items.push({
      id: 'kyc',
      label: 'Identity verification (KYC)',
      state: application.kycCompleted ? 'DONE' : 'IN_PROGRESS',
      actor: application.kycCompleted ? 'UNSPECIFIED' : 'BANK',
      why: 'The bank is legally required to verify who you are before it can lend. This is not a judgement on your application.',
    });
  }

  if (application.amlCheckCompleted != null) {
    items.push({
      id: 'aml',
      label: 'Anti-money-laundering check',
      state: application.amlCheckCompleted ? 'DONE' : 'IN_PROGRESS',
      actor: application.amlCheckCompleted ? 'UNSPECIFIED' : 'BANK',
      why: 'A regulatory screening the bank must complete before funds can be released.',
    });
  }

  tasks?.filter(isPending).forEach(task => {
    const overdue = isOverdue(task);
    items.push({
      id: `task:${task.id}`,
      label: task.title || TASK_TYPE_LABELS[task.taskType] || task.taskType,
      state: task.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OUTSTANDING',
      actor: CUSTOMER_TASK_TYPES.has(task.taskType)
        ? 'YOU'
        : BANK_TASK_TYPES.has(task.taskType)
          ? 'BANK'
          : 'UNSPECIFIED',
      why: task.description || 'Raised by the bank against your application.',
      note: overdue ? 'Overdue' : dueDateLabel(task.slaDueAt) ?? undefined,
    });
  });

  // A completed application is terminal but is still worth stating; a declined
  // or withdrawn one is covered by the page's own terminal message.
  if (!isDraft && statusInfo && (!statusInfo.terminal || statusInfo.stage === 'COMPLETED')) {
    if (statusInfo.stage === 'OFFER') {
      // The offer stage spans "decision made, offer being prepared" through "offer issued".
      // Only an issued offer is something the customer can act on; before that the honest
      // statement is that the assessment finished and the bank owes them an offer.
      if (offer?.offer?.status === 'ISSUED') {
        items.push({ id: 'stage:OFFER', ...STAGE_ITEM.OFFER! });
      } else {
        items.push({
          id: 'stage:OFFER',
          label: 'Credit assessment',
          state: 'DONE',
          actor: 'UNSPECIFIED',
          why: 'The bank has made its lending decision and is preparing your offer.',
        });
      }
    } else {
      const stageItem = STAGE_ITEM[statusInfo.stage];
      if (stageItem) {
        items.push({ id: `stage:${statusInfo.stage}`, ...stageItem });
      }
    }
  }

  return items;
}

export function ApplicationCompanion({
  application,
  statusInfo,
}: {
  application: LoanApplication;
  statusInfo: CustomerStatusInfo | null;
}) {
  const applicationId = application.applicationId;
  /* null means "could not be read" — deliberately distinct from an empty list,
     which means the bank genuinely has nothing outstanding. */
  const [tasks, setTasks] = useState<CustomerTask[] | null>(null);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [offer, setOffer] = useState<OfferWithConditions | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setSummary(null);
    setOffer(null);

    taskService
      .getTasksByApplication(applicationId)
      .then(result => {
        if (!cancelled) setTasks(result ?? []);
      })
      .catch(() => {
        if (!cancelled) setTasks(null);
      });

    documentService
      .getDocumentSummary(applicationId)
      .then(result => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });

    offerService
      .getLatestOffer(applicationId)
      .then(result => {
        if (!cancelled) setOffer(result ?? null);
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const items = useMemo(
    () => buildItems(application, statusInfo, tasks, summary, offer),
    [application, statusInfo, tasks, summary, offer]
  );

  const openForYou = items.filter(item => item.state !== 'DONE' && item.actor === 'YOU');
  const openForBank = items.filter(item => item.state !== 'DONE' && item.actor === 'BANK');
  const done = items.filter(item => item.state === 'DONE').length;

  const headline =
    openForYou.length === 1
      ? 'One thing needs you'
      : openForYou.length > 1
        ? `${openForYou.length} things need you`
        : openForBank.length > 0
          ? 'The bank is acting — nothing needed from you'
          : statusInfo?.terminal
            ? 'This application is closed'
            : 'Nothing outstanding';

  return (
    <section className="panel" aria-labelledby="companion-title">
      <div className="panel-header">
        <h2 id="companion-title" className="panel-title">
          What happens next
        </h2>
        <span className="chip">
          {done} of {items.length} complete
        </span>
      </div>

      <div className="border-b p-5" style={{ borderColor: 'var(--surface-border)' }}>
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {headline}
        </p>
        {statusInfo && !statusInfo.terminal && (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {statusInfo.headline}
          </p>
        )}
        {(tasks === null || summary === null) && items.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks === null && summary === null
              ? 'Tasks and document requests could not be loaded, so this list may be incomplete.'
              : tasks === null
                ? 'Tasks could not be loaded, so this list may be incomplete.'
                : 'Document requests could not be loaded, so this list may be incomplete.'}
          </p>
        )}
      </div>

      <ol className="divide-token">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-3 px-5 py-4">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${STATE_TONE[item.state]}`}
              style={{ borderColor: 'currentColor' }}
            >
              {item.state === 'DONE' ? '✓' : item.state === 'IN_PROGRESS' ? '…' : '!'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  {item.label}
                </p>
                <span className="shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {STATE_LABEL[item.state]}
                  {item.actor !== 'UNSPECIFIED' && ` · ${ACTOR_LABEL[item.actor]}`}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                {item.why}
              </p>
              {(item.note || item.href) && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {item.note && (
                    <span className="chip">{item.note}</span>
                  )}
                  {item.href && item.actionLabel && (
                    <Link
                      href={item.href}
                      className="text-sm font-semibold"
                      style={{ color: 'var(--brand-on-soft)' }}
                    >
                      {item.actionLabel} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
