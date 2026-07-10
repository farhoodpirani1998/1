import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

function ChevronSeparator() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink/25 dark:text-paper/25">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

// Trail of links, e.g. "دانش‌آموزان ‹ علی رضایی ‹ صورت‌حساب". The last
// item (current page) renders as plain text, not a link. Items without
// a `to` also render as plain text (useful for a non-clickable current
// section).
export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="مسیر صفحه" className={`flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronSeparator />}
            {item.to && !isLast ? (
              <Link to={item.to} className="text-ink/50 transition-colors hover:text-action dark:text-paper/50">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-ink dark:text-paper' : 'text-ink/50 dark:text-paper/50'}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
