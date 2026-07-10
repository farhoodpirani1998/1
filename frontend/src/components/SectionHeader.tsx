import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// Smaller than PageHeader — for a labeled sub-section between cards on a
// page (e.g. "روند درآمد", "دانش‌آموزان بدهکار") rather than the page
// title itself. Card already has its own `title`/`action` props for the
// common case of a titled card; SectionHeader is for section breaks that
// sit outside a Card (or above a group of cards).
export function SectionHeader({ title, description, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink dark:text-paper">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink/45 dark:text-paper/45">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
