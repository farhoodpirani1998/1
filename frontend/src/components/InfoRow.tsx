import type { ReactNode } from 'react';

// Was previously a module-private function in StudentDetailPage.tsx —
// moved here so it can be reused by the parent portal pages without
// redefining the same 6-line helper.
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-ink/50 dark:text-paper/50">{label}</span>
      <span className="tabular text-ink dark:text-paper">{value}</span>
    </div>
  );
}
