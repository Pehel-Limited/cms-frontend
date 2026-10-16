import { apiClient } from './client';

/**
 * Parallel AI-first Credit Case Manager journey (Rayva AI Assistant) —
 * Need Discovery -> Intent Review slice (AI_FIRST_CUSTOMER_LOAN_JOURNEY.md §21).
 * Talks to bff-customer's /api/customer/ai/credit-journeys/** endpoints, which
 * are gated by customer.ai-credit-agent.enabled (returns 404 when disabled).
 */

export interface IntentOption {
  code: string;
  label: string;
  description: string;
}

/**
 * Client-side mirror of ai-assistant-service's `IntentCatalog` (fixed,
 * bank-approved purpose codes — AI_FIRST_CUSTOMER_LOAN_JOURNEY.md §2.1).
 * Used to render intent option chips immediately, before a journey has been
 * started (the server only returns `intentOptions` as part of a
 * `CreditJourney`, which doesn't exist yet on the first screen).
 */
export const DEFAULT_INTENT_OPTIONS: IntentOption[] = [
  { code: 'BUSINESS_EQUIPMENT_PURCHASE', label: 'Buy business equipment', description: 'Finance for machinery, tools or other business equipment' },
  { code: 'CASH_FLOW_MANAGEMENT', label: 'Manage short-term cash flow', description: 'Cover short-term working capital needs' },
  { code: 'COMMERCIAL_PROPERTY_PURCHASE', label: 'Purchase business premises', description: 'Finance to buy commercial property' },
  { code: 'VEHICLE_PURCHASE', label: 'Buy a vehicle', description: 'Finance for a car, van or other vehicle' },
  { code: 'BUSINESS_EXPANSION', label: 'Grow or expand my business', description: 'Finance to grow or expand an existing business' },
  { code: 'REFINANCE_EXISTING_BORROWING', label: 'Refinance existing borrowing', description: 'Replace or restructure existing borrowing' },
  { code: 'HOME_PURCHASE', label: 'Buy a home', description: 'Finance to purchase a residential property' },
  { code: 'PERSONAL_BORROWING', label: 'Personal borrowing', description: 'General personal finance needs' },
  { code: 'OVERDRAFT', label: 'Arrange an overdraft', description: 'An overdraft on your existing account' },
  { code: 'CREDIT_CARD', label: 'Apply for a credit card', description: 'A new credit card' },
  { code: 'OTHER', label: 'Something else', description: "A credit need that doesn't fit the options above" },
];

/** Structured interpretation of the customer's credit need (CreditNeedDraft). */
export interface CreditNeedFacts {
  purpose: string;
  rawDescription?: string | null;
  assetCondition?: string | null;
  estimatedCost?: number | null;
  currency?: string | null;
  targetDate?: string | null;
  borrowerSegment?: string | null;
  assetCategory?: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  needsClarification: boolean;
  clarifyingQuestion?: string | null;
  customerExplanation?: string | null;
}

/**
 * Client-side mirror of ai-assistant-service's `CreditNeedDraft` taxonomy
 * constants — who the borrower is, mirroring how the bank splits lending into
 * separate product lines (Business Loans vs Farm Loans vs personal lending).
 */
export const BORROWER_SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'SOLE_TRADER', label: 'Sole trader' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'FARM_AGRICULTURE', label: 'Farm / agriculture' },
  { value: 'UNKNOWN', label: 'Not sure yet' },
];

/**
 * The borrower types a customer can meaningfully choose between — mirrors the interview's own
 * `BORROWER_TYPE_CHOICES`. Personal is absent because the account decides that, and "Not sure yet"
 * is absent because it resolves nothing: it only leaves the journey unable to be confirmed.
 */
export const BORROWER_TYPE_CHOICES: { value: string; label: string }[] =
  BORROWER_SEGMENT_OPTIONS.filter(o => o.value !== 'PERSONAL' && o.value !== 'UNKNOWN');

/**
 * Who the borrowing is for, as far as the bank's own record already settles it. Mirrors
 * `SuitabilityInterviewService.ask` and `LendingSegment.borrowerTypeOf`, which read the same
 * system-verified facts.
 *
 * The lending segment and the legal form are resolved from the customer record and are not the
 * customer's to declare — offering them as a question invites somebody on a personal account to
 * pick "Company". Farm wins over the legal form because a company that farms land is a farm
 * borrowing, and the sector is the only place that distinction is made. Null means the record
 * genuinely does not say, which is the only case worth asking in.
 *
 * `correctable` is false only for the personal-versus-business gate: choosing to be a company does
 * not open the SME range to a personal account, and the interview stops them there, so offering
 * the choice would promise a door that does not open.
 */
export function borrowerTypeFromRecord(confirmedFacts: ConfirmedFact[] | undefined): {
  value: string;
  label: string;
  basis: string;
  correctable: boolean;
} | null {
  const fact = (key: string) => {
    const value = confirmedFacts?.find(f => f.factKey === key)?.value;
    return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
  };
  const labelOf = (value: string) =>
    BORROWER_SEGMENT_OPTIONS.find(o => o.value === value)?.label ?? value;

  if (fact('customerIndustry') === 'AGR') {
    return {
      value: 'FARM_AGRICULTURE',
      label: labelOf('FARM_AGRICULTURE'),
      basis: 'from the sector on your account',
      correctable: true,
    };
  }
  const legalForm = fact('customerBorrowerType');
  if (legalForm && legalForm !== 'UNKNOWN') {
    return {
      value: legalForm,
      label: labelOf(legalForm),
      basis: 'from your account',
      correctable: legalForm !== 'PERSONAL',
    };
  }
  // A sole trader is filed as an individual who borrows against a trade, so the segment answers
  // personal-versus-business where no legal form has been mapped onto the journey.
  const segment = fact('customerSegment');
  return segment && !segment.startsWith('BUSINESS')
    ? { value: 'PERSONAL', label: labelOf('PERSONAL'), basis: 'from your account', correctable: false }
    : null;
}

/** Client-side mirror of the `assetCondition` values `NeedInterpretationAgent` may return. */
export const ASSET_CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
  { value: 'UNKNOWN', label: 'Not stated' },
];

/** Client-side mirror of `CreditNeedDraft.ASSET_CATEGORIES`. */
export const ASSET_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'AGRICULTURAL_MACHINERY', label: 'Agricultural machinery' },
  { value: 'COMMERCIAL_VEHICLE', label: 'Commercial vehicle' },
  { value: 'PRIVATE_VEHICLE', label: 'Private vehicle' },
  { value: 'CONSTRUCTION_PLANT', label: 'Construction plant' },
  { value: 'MANUFACTURING_MACHINERY', label: 'Manufacturing machinery' },
  { value: 'IT_TECHNOLOGY', label: 'IT / technology' },
  { value: 'MEDICAL_DENTAL', label: 'Medical / dental' },
  { value: 'CATERING_HOSPITALITY', label: 'Catering / hospitality' },
  { value: 'OFFICE_FURNITURE', label: 'Office furniture / fit-out' },
  { value: 'RENEWABLE_ENERGY', label: 'Renewable energy' },
  { value: 'OTHER', label: 'Other' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
];

/** Purposes ambiguous about who the borrower is — mirrors `IntentCatalog.requiresBorrowerSegment`. */
const BORROWER_SEGMENT_PURPOSES = new Set([
  'BUSINESS_EQUIPMENT_PURCHASE', 'VEHICLE_PURCHASE', 'BUSINESS_EXPANSION',
  'CASH_FLOW_MANAGEMENT', 'COMMERCIAL_PROPERTY_PURCHASE', 'REFINANCE_EXISTING_BORROWING',
]);

/** Purposes where asset type materially changes the product route — mirrors `IntentCatalog.requiresAssetCategory`. */
const ASSET_CATEGORY_PURPOSES = new Set(['BUSINESS_EQUIPMENT_PURCHASE', 'VEHICLE_PURCHASE']);

export function requiresBorrowerSegment(purposeCode?: string | null): boolean {
  return !!purposeCode && BORROWER_SEGMENT_PURPOSES.has(purposeCode);
}

export function requiresAssetCategory(purposeCode?: string | null): boolean {
  return !!purposeCode && ASSET_CATEGORY_PURPOSES.has(purposeCode);
}

export interface StageReview {
  reviewId: string;
  stageCode: string;
  reviewVersion: number;
  status: 'DRAFT' | 'PRESENTED' | 'CONFIRMED' | 'SUPERSEDED' | string;
  facts: CreditNeedFacts;
  presentedAt?: string | null;
  confirmedAt?: string | null;
}

export interface ConversationMessage {
  messageId: string;
  role: 'CUSTOMER' | 'AGENT' | 'SYSTEM_NOTICE' | string;
  content: string;
  stageCode?: string | null;
  createdAt: string;
}

export interface ConfirmedFact {
  factKey: string;
  value: unknown;
  provenanceType: string;
  version: number;
  confirmedAt?: string | null;
}

export interface CreditJourney {
  journeyId: string;
  bankId: string;
  customerId: string;
  applicationId?: string | null;
  status: string;
  currentStage: string;
  pausedReason?: string | null;
  lastActiveAt?: string | null;
  currentReview: StageReview | null;
  recentMessages: ConversationMessage[];
  confirmedFacts: ConfirmedFact[];
  intentOptions: IntentOption[];
  /** The guided suitability interview, present once the credit need is confirmed. */
  suitability?: SuitabilityStage | null;
}

/**
 * One step of the guided suitability interview, exactly as the rule engine produced it.
 *
 * Every string here is bank configuration, so the portal renders it without rewording: the question,
 * the option labels, the "why are we asking" copy and the not-a-credit-decision statement. A
 * paraphrase in the UI would be a disclosure the bank never approved.
 */
export interface SuitabilityStage {
  state:
    | 'REASON_REQUIRED'
    | 'BORROWER_TYPE_REQUIRED'
    | 'ASKING'
    | 'CONFIRM'
    | 'READY'
    | 'NOT_APPLICABLE'
    | 'NOT_CONFIGURED'
    | 'ENGINE_UNAVAILABLE'
    | 'PATH_TOO_LONG'
    | string;
  message?: string | null;
  choices: { code: string; label: string }[];
  /** Post the answer against this step id; a stale click then fails instead of answering the wrong question. */
  expectedStepId?: string | null;
  questionType?: string | null;
  /**
   * An answer the assistant inferred from words the customer already used. Nothing becomes part of
   * the journey until they answer this — see confirmProposal.
   */
  proposal?: {
    stepId: string;
    question?: string | null;
    code: string;
    label: string;
    fromUtterance?: string | null;
  } | null;
  youToldUs?: string | null;
  questionNumber?: number | null;
  questionTotal?: number | null;
  helpText?: string | null;
  conditions?: string[];
  clears?: string[];
  answered?: { question: string; answer: string }[];
  outcome?: string | null;
  suggestionReason?: string | null;
  notADecisionStatement?: string | null;
  recommended?: SuitabilityProduct[];
  unavailableCategories?: { code: string; name: string; reasonCode: string }[];
  suppressed?: { productCode: string; productName: string; reasonCode: string }[];
  supportReference?: string | null;
  ruleSetName?: string | null;
  ruleSetVersion?: number | null;
  /**
   * Questions the customer can answer on one screen, because none of them is any less applicable
   * because of an answer to another. Empty when the stage asks a single question, which is every
   * gated question — those cannot be rendered until something earlier is answered.
   */
  group?: SuitabilityGroupQuestion[];
  /**
   * Set when the interview worked out farm-versus-business borrowing from the sector on the
   * account instead of being told. Carries the wording and the options that correct it.
   */
  borrowingTypeBasis?: {
    borrowingType: string;
    statement: string;
    options?: { code: string; label: string }[];
  } | null;
}

export interface SuitabilityGroupQuestion {
  id: string;
  /** single | multi | dropdown | yesno */
  type: string;
  text: string;
  min?: number | null;
  options: { code: string; label: string }[];
  helpText?: string | null;
  conditions?: string[];
  clears?: string[];
  /**
   * What the assistant read out of the customer's own description of their need. Pre-selected on
   * screen and nothing is stored until they submit it, so a wrong guess costs a tap.
   */
  proposedCode?: string | null;
  proposedLabel?: string | null;
}

export interface SuitabilityProduct {
  productId: string;
  productCode: string;
  productName: string;
  /** The bank's own line about this product. Not the outcome category — one product can serve several. */
  description?: string | null;
  productPage?: string | null;
  needsReview: boolean;
}

export const aiCreditJourneyService = {
  /** Start a new journey with a free-text message and/or a selected intent code. */
  async start(initialMessage?: string, selectedIntentCode?: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>('/api/customer/ai/credit-journeys', {
      initialMessage,
      selectedIntentCode,
    });
  },

  async getJourney(journeyId: string): Promise<CreditJourney> {
    return apiClient.get<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}`);
  },

  async sendMessage(journeyId: string, message: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}/messages`, {
      message,
    });
  },

  async selectIntent(journeyId: string, intentCode: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(
      `/api/customer/ai/credit-journeys/${journeyId}/intent-selection`,
      { intentCode }
    );
  },

  async confirmReview(journeyId: string, reviewId: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(
      `/api/customer/ai/credit-journeys/${journeyId}/reviews/${reviewId}/confirm`
    );
  },

  async requestRevision(
    journeyId: string,
    reviewId: string,
    updatedFacts: Record<string, unknown>
  ): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(
      `/api/customer/ai/credit-journeys/${journeyId}/reviews/${reviewId}/request-revision`,
      { updatedFacts }
    );
  },

  async pause(journeyId: string, reason?: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}/pause`, {
      reason,
    });
  },

  async resume(journeyId: string): Promise<CreditJourney> {
    return apiClient.post<CreditJourney>(`/api/customer/ai/credit-journeys/${journeyId}/resume`);
  },

  /**
   * Turns the confirmed credit need into a REAL draft application —
   * prefilled from the journey's confirmed facts, no re-entry required.
   * The customer still reviews and explicitly submits it via the normal
   * application flow; nothing is auto-submitted here.
   */
  async prepareApplication(
    journeyId: string,
    productId: string
  ): Promise<{ applicationId: string; applicationNumber: string }> {
    return apiClient.post(`/api/customer/ai/credit-journeys/${journeyId}/prepare-application`, {
      productId,
    });
  },

  /** Refresh the interview step without pulling the whole conversation back. */
  async getSuitability(journeyId: string): Promise<SuitabilityStage> {
    return apiClient.get<SuitabilityStage>(
      `/api/customer/ai/credit-journeys/${journeyId}/suitability`
    );
  },

  /** Question 1: the main reason for borrowing, chosen from the codes the engine offered. */
  async selectSuitabilityReason(journeyId: string, reasonCode: string): Promise<SuitabilityStage> {
    return apiClient.post<SuitabilityStage>(
      `/api/customer/ai/credit-journeys/${journeyId}/suitability/reason`,
      { reasonCode }
    );
  },

  /**
   * Who the borrowing is for, when the confirmed need never said. This chooses which reasons the
   * engine offers — it is not the lending segment on the account, which the customer cannot change.
   */
  async setBorrowerType(journeyId: string, code: string): Promise<SuitabilityStage> {
    return apiClient.post<SuitabilityStage>(
      `/api/customer/ai/credit-journeys/${journeyId}/suitability/borrower-type`,
      { code }
    );
  },

  /**
   * Answer the current question from its offered options.
   *
   * Free text is not sent here — it goes through sendMessage, where the assistant maps it onto one of
   * these same codes and re-asks if it cannot, so the browser never chooses an answer for the customer.
   */
  async answerSuitability(
    journeyId: string,
    stepId: string,
    codes: string[]
  ): Promise<SuitabilityStage> {
    return apiClient.post<SuitabilityStage>(
      `/api/customer/ai/credit-journeys/${journeyId}/suitability/answer`,
      { stepId, codes }
    );
  },

  /**
   * A grouped screen submitted at once. The engine stores every answer before it works out what to
   * ask next, so a half-answered screen cannot advance the interview.
   */
  async answerSuitabilityGroup(
    journeyId: string,
    answers: Record<string, string[]>
  ): Promise<SuitabilityStage> {
    return apiClient.post<SuitabilityStage>(
      `/api/customer/ai/credit-journeys/${journeyId}/suitability/answer`,
      { answers }
    );
  },

  /**
   * Yes or no to something the assistant inferred from what the customer already said.
   *
   * This call is the only thing that turns an inference into an answer, so the audit trail can tell
   * a bank answer from a machine guess.
   */
  async confirmProposal(
    journeyId: string,
    stepId: string,
    accept: boolean
  ): Promise<SuitabilityStage> {
    return apiClient.post<SuitabilityStage>(
      `/api/customer/ai/credit-journeys/${journeyId}/suitability/confirm-proposal`,
      { stepId, accept }
    );
  },
};
