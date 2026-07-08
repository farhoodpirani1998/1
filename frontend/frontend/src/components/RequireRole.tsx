import { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../types/auth.types';

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center">
        <div className="mb-2 text-lg font-semibold text-ink">دسترسی محدود</div>
        <p className="text-sm text-ink/60">شما اجازه‌ی دسترسی به این بخش را ندارید.</p>
      </div>
    );
  }

  return <>{children}</>;
}
