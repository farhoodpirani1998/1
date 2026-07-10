import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-white shadow-card transition-shadow duration-200 dark:border-white/10 dark:bg-white/[0.03] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 dark:border-white/10">
          {title && <h3 className="text-sm font-semibold text-ink dark:text-paper">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
