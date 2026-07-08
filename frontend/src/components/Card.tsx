import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-card dark:border-white/10 dark:bg-white/5 ${className}`}>
      {title && (
        <div className="border-b border-line px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold text-ink dark:text-paper">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
