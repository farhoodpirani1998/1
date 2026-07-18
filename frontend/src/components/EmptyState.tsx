import type { ReactNode } from 'react';
import { DefaultIcon } from './icons/SchoolIcons';

interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

// Consistent "no data" placeholder. Visually replaces the ad-hoc
// `<div className="py-8 text-center text-sm text-ink/50">...</div>`
// pattern already scattered across pages — offered here as a shared,
// slightly richer component (icon + message + optional description/action)
// for new or updated empty states without touching existing ones.
export function EmptyState({ message, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper text-ink/30 dark:bg-white/5 dark:text-paper/30">
        {icon ?? <DefaultIcon size={28} />}
      </div>
      <div>
        <p className="text-sm font-medium text-ink/60 dark:text-paper/60">{message}</p>
        {description && <p className="mt-1 text-xs text-ink/40 dark:text-paper/40">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
