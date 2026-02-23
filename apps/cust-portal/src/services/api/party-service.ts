import config from '@/config';

// ─── Types ─────────────────────────────────────────────────────────

export interface PartyMember {
  id: string;
  entityId: string;
  customerId: string;
  role: string;
  roleTitle?: string;
  ownershipPercentage?: number;
  shareClass?: string;
  numberOfShares?: number;
  appointmentDate?: string;
  resignationDate?: string;
  isActive: boolean;
  isAuthorizedSignatory: boolean;
  signingLimit?: number;
  isBeneficialOwner: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddPartyPayload {
  customerId: string;
  role: string;
  roleTitle?: string;
  ownershipPercentage?: number;
  shareClass?: string;
  numberOfShares?: number;
  appointmentDate?: string;
  isAuthorizedSignatory?: boolean;
  signingLimit?: number;
  isBeneficialOwner?: boolean;
}

export interface UpdatePartyPayload {
  role?: string;
  roleTitle?: string;
  ownershipPercentage?: number;
  shareClass?: string;
  numberOfShares?: number;
  appointmentDate?: string;
  resignationDate?: string;
  isActive?: boolean;
  isAuthorizedSignatory?: boolean;
  signingLimit?: number;
  isBeneficialOwner?: boolean;
}

export interface PartyValidation {
  isComplete: boolean;
  issues: string[];
  summary: {
    totalMembers: number;
    directors: number;
    shareholders: number;
    ubos: number;
    totalUboOwnership: number;
    signatories: number;
  };
}

export interface ApplicationParties {
  linked: boolean;
  entityId?: string;
  members: PartyMember[];
}

export interface LinkPartiesResult {
  linked: boolean;
  entityId: string;
  valid: boolean;
  warnings: string[];
  summary: {
    totalMembers: number;
    directors: number;
    ubos: number;
    totalUboOwnership: number;
    signatories: number;
  };
}

export const PARTY_ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Director',
  SHAREHOLDER: 'Shareholder',
  SECRETARY: 'Secretary',
  PARTNER: 'Partner',
  TRUSTEE: 'Trustee',
  TREASURER: 'Treasurer',
  CHAIRPERSON: 'Chairperson',
  MEMBER: 'Member',
  BENEFICIAL_OWNER: 'Beneficial Owner',
  AUTHORIZED_SIGNATORY: 'Authorized Signatory',
  OTHER: 'Other',
};

// ─── API Service ───────────────────────────────────────────────────

const BFF_BASE = config.api.baseUrl;

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(config.auth.tokenKey) : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Request failed (${res.status})` }));
    throw {
      status: res.status,
      message: err.message || err.error || `Request failed (${res.status})`,
    };
  }
  return res.json();
}

export const partyService = {
  // ─── Company Party Management ────────────────────────────────

  /** GET /api/customer/company/parties */
  async listParties(role?: string): Promise<PartyMember[]> {
    const params = role ? `?role=${encodeURIComponent(role)}` : '';
    const res = await fetch(`${BFF_BASE}/api/customer/company/parties${params}`, {
      headers: authHeaders(),
    });
    return handleResponse<PartyMember[]>(res);
  },

  /** POST /api/customer/company/parties */
  async addParty(data: AddPartyPayload): Promise<PartyMember> {
    const res = await fetch(`${BFF_BASE}/api/customer/company/parties`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PartyMember>(res);
  },

  /** PUT /api/customer/company/parties/:memberId */
  async updateParty(memberId: string, data: UpdatePartyPayload): Promise<PartyMember> {
    const res = await fetch(`${BFF_BASE}/api/customer/company/parties/${memberId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PartyMember>(res);
  },

  /** DELETE /api/customer/company/parties/:memberId */
  async removeParty(memberId: string): Promise<void> {
    const res = await fetch(`${BFF_BASE}/api/customer/company/parties/${memberId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ message: 'Delete failed' }));
      throw { status: res.status, message: err.message || 'Delete failed' };
    }
  },

  /** GET /api/customer/company/parties/validation */
  async validateParties(): Promise<PartyValidation> {
    const res = await fetch(`${BFF_BASE}/api/customer/company/parties/validation`, {
      headers: authHeaders(),
    });
    return handleResponse<PartyValidation>(res);
  },

  // ─── Application Party Linkage ───────────────────────────────

  /** POST /api/customer/applications/:id/parties/link */
  async linkParties(applicationId: string): Promise<LinkPartiesResult> {
    const res = await fetch(`${BFF_BASE}/api/customer/applications/${applicationId}/parties/link`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleResponse<LinkPartiesResult>(res);
  },

  /** GET /api/customer/applications/:id/parties */
  async getApplicationParties(applicationId: string): Promise<ApplicationParties> {
    const res = await fetch(`${BFF_BASE}/api/customer/applications/${applicationId}/parties`, {
      headers: authHeaders(),
    });
    return handleResponse<ApplicationParties>(res);
  },
};
