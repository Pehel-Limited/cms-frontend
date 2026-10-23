import { apiClient } from './client';

/**
 * Cited answers for the "Ask Rayva AI" chat in the customer portal.
 *
 * The BFF restricts this to sources the bank has published to customers, so a
 * NOT_FOUND here means "not in anything you may be told", not "not in the bank's files".
 */

export type KnowledgeAnswerStatus =
  | 'ANSWERED'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_EVIDENCE'
  | 'FAILED';

export interface KnowledgeCitation {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceVersion?: string | null;
  chunkIndex: number;
  headingPath?: string | null;
  pageFrom?: number | null;
  pageTo?: number | null;
  sectionReference?: string | null;
  snippet: string;
}

export interface KnowledgeAnswer {
  answerStatus: string;
  answer?: string | null;
  sourcesUsed?: number | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  results?: KnowledgeCitation[] | null;
}

class KnowledgeChatService {
  /** Generation is a remote LLM call — measured at ~15s for a grounded answer. */
  ask(question: string, limit = 5): Promise<KnowledgeAnswer> {
    return apiClient.post<KnowledgeAnswer>('/api/customer/ai/knowledge/ask', { question, limit });
  }
}

export const knowledgeChatService = new KnowledgeChatService();
