import type { UserRole } from '../types/auth.types';

// Client-side mirror of backend's common/authorization/permissions.ts.
// ONLY for hiding/showing buttons — the backend remains the sole source
// of truth and re-checks every one of these server-side. If this file
// drifts from the backend map, the worst case is a button that's shown
// but still rejected by the API (safe), never the opposite.
export enum Permission {
  PAYMENT_VOID = 'payment:void',
  DISCOUNT_UNLIMITED = 'discount:unlimited',
  INSTALLMENT_STATUS_OVERRIDE = 'installment:status-override',
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  school_admin: [
    Permission.PAYMENT_VOID,
    Permission.DISCOUNT_UNLIMITED,
    Permission.INSTALLMENT_STATUS_OVERRIDE,
  ],
  accountant: [],
  staff: [],
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
