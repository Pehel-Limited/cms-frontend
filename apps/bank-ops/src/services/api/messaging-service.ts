// services/api/messaging-service.ts
// RM ↔ customer messaging for credit applications (bff-admin /api/admin/messaging).
import { ApiClient } from './client';

const apiClient = new ApiClient();

export type SenderType = 'CUSTOMER' | 'USER' | 'SYSTEM';

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

/** A thread plus what the RM has not read yet and the newest line in it. */
export interface ConversationInboxRow {
  conversation: Conversation;
  customerName: string | null;
  requestedAmount: number | null;
  requestedTermMonths: number | null;
  unreadCount: number;
  lastMessage: Message | null;
}

export interface MessagesResponse {
  conversation: Conversation;
  messages: Message[];
}

/**
 * Preview line for a thread. The sender name is often null — the system lines and the
 * help-request body are written without one — so fall back to a fixed phrase rather than
 * printing "null:".
 */
export function previewLine(row: ConversationInboxRow): string {
  return row.lastMessage?.body?.trim() || 'No messages yet';
}

export function threadCounterpartName(row: ConversationInboxRow): string {
  return row.customerName?.trim() || 'Customer';
}

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export const messagingService = {
  /** Every thread on the requesting RM's routed book, with unread counts and previews. */
  async getInbox(): Promise<ConversationInboxRow[]> {
    return apiClient.get<ConversationInboxRow[]>('/api/admin/messaging/inbox');
  },

  /** One application's thread. Opens it if the customer has not written yet. */
  async getMessages(applicationId: string): Promise<MessagesResponse> {
    return apiClient.get<MessagesResponse>(
      `/api/admin/messaging/applications/${applicationId}/messages`
    );
  },

  /** RM sends a message, opening the thread if it does not exist. Attribution is server-side. */
  async sendMessage(applicationId: string, body: string): Promise<Message> {
    return apiClient.post<Message>(
      `/api/admin/messaging/applications/${applicationId}/messages`,
      { body }
    );
  },

  async markRead(conversationId: string): Promise<{ markedRead: number }> {
    return apiClient.post<{ markedRead: number }>(
      `/api/admin/messaging/conversations/${conversationId}/read`,
      {}
    );
  },

  async countUnread(conversationId: string): Promise<number> {
    const data = await apiClient.get<{ unread: number }>(
      `/api/admin/messaging/conversations/${conversationId}/unread`
    );
    return data.unread;
  },
};
