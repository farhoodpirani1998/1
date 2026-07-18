/**
 * Fine-grained permissions
 * ------------------------
 * `@Roles('school_admin', 'accountant')` on a controller answers "who can
 * hit this endpoint at all". It can't answer "can *this* accountant void a
 * payment, or only create one" — every accountant gets every capability of
 * their role, all-or-nothing. That's the "authorization granularity" gap.
 *
 * This adds a second, narrower layer: named permissions, mapped to roles,
 * checked with @RequirePermission(...) for the small number of sensitive
 * actions that shouldn't just be "any accountant can do this":
 *   - voiding a payment (financial correction, needs a reason)
 *   - giving a discount above a role's normal ceiling
 *   - manually overriding an installment's status (cancel/defer/dispute)
 *
 * It's intentionally NOT a full RBAC-from-DB system (that's a bigger
 * project); it's a static map that's easy to extend, and it composes with
 * the existing RolesGuard rather than replacing it.
 */
import { Role } from './roles.enum';

export enum Permission {
  PAYMENT_VOID = 'payment:void',
  DISCOUNT_UNLIMITED = 'discount:unlimited',
  INSTALLMENT_STATUS_OVERRIDE = 'installment:status-override',
  // Forgiving a remaining balance outright — higher-stakes than a normal
  // discount (which is agreed before any money is due) or a status
  // override (which doesn't change what's owed).
  INSTALLMENT_WRITE_OFF = 'installment:write-off',
  // Adding/removing an installment, or rescheduling the unpaid remainder
  // into a new set of installments, after a schedule already exists and
  // the family has been told about it.
  INSTALLMENT_SCHEDULE_EDIT = 'installment:schedule-edit',
}

// role -> permissions it holds. super_admin implicitly has everything
// (enforced in roleHasPermission below, not listed here so it can't drift
// out of sync).
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [Role.SCHOOL_ADMIN]: [
    Permission.PAYMENT_VOID,
    Permission.DISCOUNT_UNLIMITED,
    Permission.INSTALLMENT_STATUS_OVERRIDE,
    Permission.INSTALLMENT_WRITE_OFF,
    Permission.INSTALLMENT_SCHEDULE_EDIT,
  ],
  [Role.ACCOUNTANT]: [
    // accountants can record payments and normal discounts, but voiding
    // money that already moved, or overriding a schedule, needs an admin.
  ],
  [Role.STAFF]: [],
  // Parents only ever hit the read-only /parent/* routes (see
  // modules/parent), which aren't gated by @RequirePermission at all —
  // listed explicitly so it's obvious this was considered, not missed.
  [Role.PARENT]: [],
  // Teachers only ever hit the /teacher/* routes (see modules/teacher),
  // scoped further still by their TeacherAssignment rows. No sensitive
  // permission from this list applies to any of those routes — listed
  // explicitly for the same "considered, not missed" reason as PARENT.
  [Role.TEACHER]: [],
  // Founders only ever hit the read-only /founder/* routes (see
  // modules/founder) — no write endpoint anywhere checks
  // @RequirePermission for this role, so this stays empty forever, not
  // just "for now". Listed explicitly for the same "considered, not
  // missed" reason as PARENT/TEACHER.
  [Role.FOUNDER]: [],
};

export function roleHasPermission(role: string, permission: Permission): boolean {
  if (role === Role.SUPER_ADMIN) return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/**
 * Per-role ceiling for a discount given without needing
 * Permission.DISCOUNT_UNLIMITED. An accountant can apply up to this
 * fraction of baseAmount; above it, DISCOUNT_UNLIMITED is required (i.e.
 * only school_admin, per the map above).
 */
export const DISCOUNT_CEILING_RATIO: Record<string, number> = {
  [Role.ACCOUNTANT]: 0.1, // up to 10% off, no admin approval needed
  [Role.STAFF]: 0,
  [Role.SCHOOL_ADMIN]: 1, // irrelevant — school_admin has DISCOUNT_UNLIMITED anyway
};
