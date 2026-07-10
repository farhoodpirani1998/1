import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional <Breadcrumb /> or other element rendered above the title. */
  breadcrumb?: ReactNode;
  className?: string;
}

// Replaces the hand-written
//   <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
//     <h1 className="text-xl font-bold text-ink">...</h1>
//     <div className="flex gap-2">...actions...</div>
//   </div>
// pattern repeated across pages (StudentsPage, DashboardPage, ReportsPage,
// etc.) with one shared, consistent component. Existing pages are left
// exactly as they are — this is for new or updated page headers.
export function PageHeader({ title, description, actions, breadcrumb, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink dark:text-paper">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink/55 dark:text-paper/55">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
