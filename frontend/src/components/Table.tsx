import type { ReactNode } from 'react';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';

// Used by useTableSort.ts — kept here since it's a Table-adjacent concept,
// even though Table itself doesn't render sort UI yet.
export type SortDirection = 'asc' | 'desc';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** RTL-aware alignment for this column's cells. Defaults to 'right'. */
  align?: 'right' | 'left' | 'center';
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  emptyDescription?: string;
  /** Icon shown in the empty state — defaults to EmptyState's generic icon. */
  emptyIcon?: ReactNode;
  /** Call-to-action rendered under the empty-state message, e.g. an
   *  "add now" button when the underlying dataset (not just a filter/search)
   *  is genuinely empty. */
  emptyAction?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  /** Sticks the header below the app's fixed topbar while the page scrolls
   *  (long tables). Off by default since some tables render inside their
   *  own scroll containers where a page-relative offset wouldn't be right. */
  stickyHeader?: boolean;
}

const ALIGN_CLASS: Record<NonNullable<TableColumn<unknown>['align']>, string> = {
  right: 'text-right',
  left: 'text-left',
  center: 'text-center',
};

// Generic table matching the markup already hand-written per page
// (thead: border-b border-line text-ink/50 · tbody rows: border-b
// border-line/60 last:border-0 · row hover comes for free from the
// global `table tbody tr:hover` rule in index.css). Offered as a shared,
// typed building block — existing raw <table> usages in pages are left
// exactly as they are.
export function Table<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 5,
  emptyMessage = 'موردی برای نمایش وجود ندارد.',
  emptyDescription,
  emptyIcon,
  emptyAction,
  className = '',
  onRowClick,
  stickyHeader = false,
}: TableProps<T>) {
  if (loading) {
    return <SkeletonTable rows={skeletonRows} cols={columns.length} />;
  }

  if (data.length === 0) {
    return <EmptyState message={emptyMessage} description={emptyDescription} icon={emptyIcon} action={emptyAction} />;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-ink/50 dark:border-white/10 dark:text-paper/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 font-medium ${ALIGN_CLASS[col.align ?? 'right']} ${
                  stickyHeader ? 'sticky top-16 z-[5] bg-white dark:bg-navy-dark' : ''
                } ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line/60 last:border-0 transition-colors duration-100 dark:border-white/10 ${
                i % 2 === 1 ? 'bg-ink/[0.015] dark:bg-white/[0.02]' : ''
              } ${onRowClick ? 'cursor-pointer' : ''} hover:bg-action/[0.06] dark:hover:bg-action/[0.12]`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3 ${ALIGN_CLASS[col.align ?? 'right']} ${col.cellClassName ?? ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
