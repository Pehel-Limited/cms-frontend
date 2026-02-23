import config from '@/config';

// ─── Types ─────────────────────────────────────────────────────────

export type PortalRole = 'ADMIN' | 'FINANCE_UPLOADER' | 'SIGNATORY' | 'VIEWER';

export interface TeamMember {
  id: string;
  customerId: string;
  name: string;
  email: string;
  entityRole: string;
  portalRole: PortalRole;
  isAuthorizedSignatory: boolean;
  isBeneficialOwner: boolean;
  ownershipPercentage?: number;
  isCurrentUser: boolean;
}

export interface TeamListResponse {
  entityId: string;
  entityName: string;
  totalMembers: number;
  members: TeamMember[];
  currentUserRole: PortalRole;
  canManageTeam: boolean;
}

export interface InvitePayload {
  email: string;
  role: PortalRole;
  name?: string;
}

export interface InviteResponse {
  invited: boolean;
  email: string;
  name?: string;
  role: PortalRole;
  inviteToken: string;
  expiresAt: string;
}

// ─── Role display helpers ──────────────────────────────────────────

export const ROLE_LABELS: Record<PortalRole, string> = {
  ADMIN: 'Admin',
  FINANCE_UPLOADER: 'Finance Uploader',
  SIGNATORY: 'Signatory',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<PortalRole, string> = {
  ADMIN: 'Full access to manage team, applications, and company settings',
  FINANCE_UPLOADER: 'Can upload financial documents and view applications',
  SIGNATORY: 'Can review and sign loan agreements',
  VIEWER: 'Read-only access to applications and documents',
};

export const ROLE_COLORS: Record<PortalRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  FINANCE_UPLOADER: 'bg-blue-100 text-blue-700',
  SIGNATORY: 'bg-green-100 text-green-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

// ─── API Client ────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const userId = localStorage.getItem('user_id');
    if (userId) headers['X-User-Id'] = userId;
  }
  return headers;
}

const BASE = `${config.api.baseUrl}/api/customer/team`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const teamService = {
  /** List all team members for the current user's company */
  async listTeam(): Promise<TeamListResponse> {
    const res = await fetch(BASE, { headers: getHeaders() });
    return handleResponse<TeamListResponse>(res);
  },

  /** Invite a new team member */
  async invite(payload: InvitePayload): Promise<InviteResponse> {
    const res = await fetch(`${BASE}/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<InviteResponse>(res);
  },

  /** Update a team member's portal role */
  async updateRole(memberId: string, role: PortalRole): Promise<{ updated: boolean }> {
    const res = await fetch(`${BASE}/${memberId}/role`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse<{ updated: boolean }>(res);
  },

  /** Remove a team member's portal access */
  async removeMember(memberId: string): Promise<{ removed: boolean }> {
    const res = await fetch(`${BASE}/${memberId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<{ removed: boolean }>(res);
  },
};
