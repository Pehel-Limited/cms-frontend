import type { User, Role } from '@/types/auth';

// Role keys (roleType or roleName, upper-cased) that grant bank-wide oversight.
const ADMIN_ROLE_KEYS = new Set([
  'SYSTEM_ADMIN',
  'BANK_ADMIN',
  'BANK_SUPER_ADMIN',
  'SYSTEM ADMINISTRATOR',
  'BANK ADMINISTRATOR',
  'BANK SUPER ADMIN',
]);

/**
 * True when the user holds a bank/system administrator role. Admins get the
 * cross-RM oversight dashboard; everyone else (e.g. Relationship Managers) gets
 * their own scoped queue. `roles` may be Role objects or bare role-type strings.
 */
export function isAdminRole(user?: User | null): boolean {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.some((r: Role | string) => {
    if (typeof r === 'string') return ADMIN_ROLE_KEYS.has(r.trim().toUpperCase());
    return (
      ADMIN_ROLE_KEYS.has((r.roleType || '').trim().toUpperCase()) ||
      ADMIN_ROLE_KEYS.has((r.roleName || '').trim().toUpperCase())
    );
  });
}
