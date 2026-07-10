import type { ReactNode } from 'react';

interface FilterBarProps {
  /** Filter controls: SearchInput, Select, date pickers, etc. */
  children: ReactNode;
  /** Right-aligned actions, e.g. an export or "new" button. */
  actions?: ReactNode;
  className?: string;
}

// Consistent wrapper for the filter/search row that sits above a table
// (search input + status select + export button, etc.) — replaces the
// hand-written `<form className="mb-4 flex gap-2">` / `<div className="mb-4
// flex flex-wrap items-center gap-3">` rows scattered across pages with one
// shared layout: filters on one side, actions pushed to the other, wrapping
// gracefully on narrow screens.
export function FilterBar({ children, actions, className = '' }: FilterBarProps) {
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
