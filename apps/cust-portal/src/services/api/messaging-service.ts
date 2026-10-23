import { apiClient } from './client';
import { formatCurrency } from '@/lib/format';

// ─── Types ─────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  applicationId: string;
  bankId: string;
  customerId: string;
  subject: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

export type SenderType = 'CUSTOMER' | 'USER' | 'SYSTEM';

export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string;
  senderName: string | null;
  body: string;
  correlationId: string | null;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface MessagesResponse {
  conversation: Conversation;
  messages: Message[];
}

/** A thread plus how much of it the customer has not read and its newest line. */
export interface ConversationInboxRow {
  conversation: Conversation;
  customerName: string | null;
  requestedAmount: number | null;
  requestedTermMonths: number | null;
  unreadCount: number;
  lastMessage: Message | null;
}

export interface TaskResponse {
  id: string;
  applicationId: string;
  taskType: string;
  status: string;
  queue: string;
  priority: string;
  title: string;
  description: string;
  assignedTo: string | null;
  slaDueAt: string | null;
  createdAt: string;
}

// ─── Labels & Colors ───────────────────────────────────────────

export const SENDER_TYPE_LABELS: Record<SenderType, string> = {
  CUSTOMER: 'You',
  USER: 'RM',
  SYSTEM: 'System',
};

export const SENDER_TYPE_COLORS: Record<SenderType, string> = {
  CUSTOMER: 'bg-indigo-100 text-indigo-800',
  USER: 'bg-emerald-100 text-emerald-800',
  SYSTEM: 'bg-gray-100 text-gray-600',
};

// ─── Helpers ───────────────────────────────────────────────────

/**
 * The line shown under a thread in the inbox and in the notification list. The newest message
 * can be absent (a thread created but never written to) and its body can be blank, so both fall
 * back to the same quiet wording rather than rendering an empty row.
 */
export function previewLine(row: ConversationInboxRow): string {
  return row.lastMessage?.body?.trim() || 'No messages yet';
}

/** What a thread is about. A customer can hold several applications, so the ask names it. */
export function threadLabel(row: ConversationInboxRow): string {
  const parts: string[] = [];
  if (row.requestedAmount != null) parts.push(formatCurrency(row.requestedAmount));
  if (row.requestedTermMonths != null) parts.push(`${row.requestedTermMonths} months`);
  return parts.length ? parts.join(' over ') : 'Your application';
}

export function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Service ───────────────────────────────────────────────────

export const messagingService = {
  /** Get messages for an application (auto-creates conversation). */
  async getMessages(applicationId: string): Promise<MessagesResponse> {
    return apiClient.get<MessagesResponse>(`/api/customer/applications/${applicationId}/messages`);
  },

  /** Send a message for an application. */
  async sendMessage(applicationId: string, body: string): Promise<Message> {
    return apiClient.post<Message>(`/api/customer/applications/${applicationId}/messages`, {
      body,
    });
  },

  /** Request RM help — creates an RM task + conversation message. */
  async createHelpRequest(
    applicationId: string,
    subject: string,
    body: string
  ): Promise<TaskResponse> {
    return apiClient.post<TaskResponse>(
      `/api/customer/applications/${applicationId}/help-request`,
      { subject, body }
    );
  },

  /** Request a callback — creates a CALLBACK_REQUEST task. */
  async createCallbackRequest(
    applicationId: string,
    payload: {
      preferredDate?: string;
      preferredTimeSlot?: string;
      notes?: string;
    }
  ): Promise<TaskResponse> {
    return apiClient.post<TaskResponse>(
      `/api/customer/applications/${applicationId}/callback-request`,
      payload
    );
  },

  /** List all conversations for the current customer, with unread counts and previews. */
  async listConversations(): Promise<ConversationInboxRow[]> {
    return apiClient.get<ConversationInboxRow[]>('/api/customer/conversations');
  },

  /** Count unread messages for an application. */
  async getUnreadCount(applicationId: string): Promise<number> {
    const data = await apiClient.get<{ unread: number }>(
      `/api/customer/applications/${applicationId}/messages/unread`
    );
    return data.unread;
  },
};
