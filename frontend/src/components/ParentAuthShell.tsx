import type { ReactNode } from 'react';

interface ParentAuthShellProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}

// Shared shell for every public parent-auth page (login, forgot-password,
// and any future step in that flow) — navy background + icon badge +
// title/subtitle + white card. This was being hand-duplicated between
// ParentLoginPage and ParentForgotPasswordPage; pulled out once both
// existed so a third page doesn't copy it a third time.
export function ParentAuthShell({ icon, title, subtitle, children }: ParentAuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-action shadow-[0_2px_8px_rgba(37,99,235,0.45)]">
            {icon}
          </div>
          <div className="text-2xl font-bold">{title}</div>
          <div className="mt-1 text-sm text-white/60">{subtitle}</div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}
