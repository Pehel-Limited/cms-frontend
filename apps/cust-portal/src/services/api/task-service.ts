import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────

export type TaskType =
  | 'PROVIDE_KYC_DOCUMENTS'
  | 'UPLOAD_DOCUMENT'
  | 'FIX_APPLICATION_FIELDS'
  | 'ACCEPT_OFFER'
  | 'SIGN_AGREEMENT'
  | 'REQUEST_MISSING_INFO'
  | 'DOCUMENT_REVIEW'
  | 'COMPLIANCE_REVIEW';

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'DONE' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CustomerTask {
  id: string;
  applicationId: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  queue: string;
  title: string;
  description: string | null;
  assignedTo: string;
  assigneeType: string;
  assignedAt: string | null;
  slaDueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TaskCountResponse {
  customerId: string;
  pendingCount: number;
}

// ─── Labels & Colours ──────────────────────────────────────────

export const TASK_TYPE_LABELS: Record<string, string> = {
  PROVIDE_KYC_DOCUMENTS: 'Provide KYC Documents',
  UPLOAD_DOCUMENT: 'Upload Document',
  FIX_APPLICATION_FIELDS: 'Update Application',
  ACCEPT_OFFER: 'Review Offer',
  SIGN_AGREEMENT: 'Sign Agreement',
  REQUEST_MISSING_INFO: 'Provide Information',
  DOCUMENT_REVIEW: 'Document Review',
  COMPLIANCE_REVIEW: 'Compliance Review',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: 'Pending',
  IN_PROGRESS: 'In Progress',
  WAITING: 'Waiting',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  WAITING: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  DONE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-200',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'text-gray-500 dark:text-gray-400',
  MEDIUM: 'text-blue-600 dark:text-blue-300',
  HIGH: 'text-orange-600 dark:text-orange-300',
  CRITICAL: 'text-red-600 dark:text-red-300',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Urgent',
};

// ─── Helpers ───────────────────────────────────────────────────

/** True if the task still needs customer action */
export function isPending(task: CustomerTask): boolean {
  return ['OPEN', 'IN_PROGRESS', 'WAITING'].includes(task.status);
}

/** Returns relative due-date label: "Overdue", "Due today", "Due in 3 days", etc. */
export function dueDateLabel(slaDueAt: string | null): string | null {
  if (!slaDueAt) return null;
  const due = new Date(slaDueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
}

/** True if SLA is breached */
export function isOverdue(task: CustomerTask): boolean {
  if (!task.slaDueAt || task.status === 'DONE' || task.status === 'CANCELLED') return false;
  return new Date(task.slaDueAt).getTime() < Date.now();
}

// ─── Service ───────────────────────────────────────────────────

export const taskService = {
  /**
   * List all tasks for the authenticated customer.
   * @param status optional: 'PENDING' | 'DONE' | raw status string
   */
  async listTasks(status?: string): Promise<CustomerTask[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<CustomerTask[]>(`/api/customer/tasks${qs}`);
  },

  /** Count pending tasks (for dashboard badge). */
  async countPending(): Promise<TaskCountResponse> {
    return apiClient.get<TaskCountResponse>('/api/customer/tasks/count');
  },

  /** Get a single task by id. */
  async getTask(taskId: string): Promise<CustomerTask> {
    return apiClient.get<CustomerTask>(`/api/customer/tasks/${taskId}`);
  },

  /** Get tasks for a specific application. */
  async getTasksByApplication(applicationId: string): Promise<CustomerTask[]> {
    return apiClient.get<CustomerTask[]>(`/api/customer/tasks/application/${applicationId}`);
  },

  /** Complete (mark done) a task. */
  async completeTask(taskId: string, notes?: string): Promise<void> {
    return apiClient.post<void>(`/api/customer/tasks/${taskId}/complete`, { notes: notes ?? null });
  },
};
