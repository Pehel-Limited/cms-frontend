import apiClient from '@/lib/api-client';

/**
 * One level of the bank sector taxonomy. The API returns industries, sectors and business
 * types in this same shape, so a cascading selector renders any level without
 * level-specific code.
 */
export interface TaxonomyNode {
  level: 'INDUSTRY' | 'SECTOR' | 'BUSINESS_TYPE';
  code: string;
  name: string;
  parentCode?: string;

  status?: string;
  origin?: string;
  displayOrder?: number;
  active?: boolean;
  catalogueVersion?: string;

  /** Sector level. Descriptive risk-driver family — not a rating and not a limit. */
  indicativeRiskSegmentCode?: string;
  indicativeRiskSegmentName?: string;

  /** Business type level. A proposal until verified against official NACE. */
  naceRevision?: string;
  naceProposedCode?: string;
  naceMappingStatus?: string;
  naceApprovalStatus?: string;
  naceOfficialTitle?: string;
  naceVerified?: boolean;
}

/** The classification of a customer legal entity, as the screens need to display it. */
export interface CustomerClassification {
  /** Only set by the bulk read; a single-customer read is already addressed by that customer. */
  customerId?: string;
  industryCode?: string;
  industryName?: string;
  sectorCode?: string;
  sectorName?: string;
  businessTypeCode?: string;
  businessTypeName?: string;
  naceRevision?: string;
  naceCode?: string;
  naceMappingStatus?: string;
  naceOfficialTitle?: string;
  naceVerified?: boolean;
  indicativeRiskSegmentCode?: string;
  indicativeRiskSegmentName?: string;
  isPrimary?: boolean;
  classificationMethod?: string;
  classificationStatus?: string;
  analystNote?: string;
  evidenceUri?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface ClassifyRequest {
  industryCode: string;
  sectorCode?: string;
  businessTypeCode?: string;
  naceCode?: string;
  primary?: boolean;
  effectiveFrom?: string;
  reasonForOverride?: string;
  evidenceUri?: string;
}

/** What a credit facility actually funds — may differ from the borrower's own sector. */
export interface FacilityAllocation {
  sectorCode?: string;
  sectorName?: string;
  allocationPct?: number;
  allocationBasis?: string;
  rationale?: string;
  approvalStatus?: string;
}

export interface AccountBusinessActivity {
  mainActivity?: CustomerClassification;
  ownerOtherActivities?: CustomerClassification[];
  useOfProceeds?: FacilityAllocation[];
  inheritsFromOwner?: boolean;
}

/** Industries are master data and effectively static, so they are fetched once per session. */
let industriesCache: Promise<TaxonomyNode[]> | null = null;

class ReferenceDataService {
  async getIndustries(): Promise<TaxonomyNode[]> {
    if (!industriesCache) {
      industriesCache = apiClient
        .get<TaxonomyNode[]>('/api/admin/reference/industries')
        .then(r => r.data)
        .catch(err => {
          // Do not poison the cache with a failed promise: a later retry should re-attempt.
          industriesCache = null;
          throw err;
        });
    }
    return industriesCache;
  }

  async getSectors(industryCode: string): Promise<TaxonomyNode[]> {
    const r = await apiClient.get<TaxonomyNode[]>(
      `/api/admin/reference/industries/${encodeURIComponent(industryCode)}/sectors`
    );
    return r.data;
  }

  async getBusinessTypes(sectorCode: string, q?: string): Promise<TaxonomyNode[]> {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    const r = await apiClient.get<TaxonomyNode[]>(
      `/api/admin/reference/sectors/${encodeURIComponent(sectorCode)}/business-types${params}`
    );
    return r.data;
  }

  async getPrimaryActivity(customerId: string): Promise<CustomerClassification | null> {
    try {
      const r = await apiClient.get<CustomerClassification>(
        `/api/admin/customers/${customerId}/activities/primary`
      );
      return r.data ?? null;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 204/404 is a real answer — an individual customer has no company activity.
      if (status === 204 || status === 404) return null;
      throw err;
    }
  }

  async getActivities(customerId: string): Promise<CustomerClassification[]> {
    const r = await apiClient.get<CustomerClassification[]>(
      `/api/admin/customers/${customerId}/activities`
    );
    return r.data;
  }

  /**
   * Principal activity for a whole page of customers in one read. Customers that have never
   * been classified are simply absent from the result rather than returned as blank rows.
   */
  async getPrimaryActivities(customerIds: string[]): Promise<CustomerClassification[]> {
    const r = await apiClient.post<CustomerClassification[]>(
      '/api/admin/customers/classifications',
      customerIds
    );
    return r.data;
  }

  /**
   * What an account is used for. Read-only: the sector master lives on the owning legal
   * entity, and an account only points at one of its activities.
   */
  async getAccountBusinessActivity(accountId: string): Promise<AccountBusinessActivity | null> {
    try {
      const r = await apiClient.get<AccountBusinessActivity>(
        `/api/accounts/${accountId}/business-activity`
      );
      return r.data ?? null;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 204 || status === 404) return null;
      throw err;
    }
  }

  async classify(customerId: string, request: ClassifyRequest): Promise<CustomerClassification> {
    const r = await apiClient.put<CustomerClassification>(
      `/api/admin/customers/${customerId}/activities`,
      request
    );
    return r.data;
  }
}

export const referenceDataService = new ReferenceDataService();

/**
 * A NACE code that has no verified official title is a proposal, not a classification.
 * The spec forbids inventing a title, so the UI states the pending state instead.
 */
export function naceDisplay(node: {
  naceCode?: string;
  naceProposedCode?: string;
  naceOfficialTitle?: string;
  naceVerified?: boolean;
  naceRevision?: string;
}): { code: string; label: string; verified: boolean } | null {
  const code = node.naceCode || node.naceProposedCode;
  if (!code) return null;
  const revision = node.naceRevision || '2.1';
  if (node.naceVerified && node.naceOfficialTitle) {
    return { code, label: `NACE ${revision} ${code} — ${node.naceOfficialTitle}`, verified: true };
  }
  return {
    code,
    label: `NACE ${revision} ${code} — official title pending verification`,
    verified: false,
  };
}
