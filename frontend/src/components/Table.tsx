import type { ReactNode } from 'react';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface TableColumn<T> {
  key: string;
  header: string;
  /** RTL-aware alignment for this column's cells. Defaults to 'right'. */
  align?: 'right' | 'left' | 'center';
  headerClassName?: string;
  cellClassName?: string;
  /** Marks this column's header as clickable for sorting. Only takes
   *  effect when the Table also receives `sortKey`/`onSortChange` —
   *  purely presentational otherwise (no default sorting behavior). */
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

export type SortDirection = 'asc' | 'desc';

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  emptyDescription?: string;
  /** Optional icon forwarded to the empty-state EmptyState. Purely
   *  presentational — omitting it falls back to EmptyState's own
   *  default icon, same as before this prop existed. */
  emptyIcon?: ReactNode;
  /** Optional CTA (e.g. a Button/Link) forwarded to the empty-state
   *  EmptyState, rendered below the message/description. Omitted by
   *  default, matching every existing caller of Table. */
  emptyAction?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  /** Key of the column currently sorted (matches TableColumn.key), or
   *  null/undefined when no column is active. Purely presentational —
   *  the caller owns the actual sorting of `data`. */
  sortKey?: string | null;
  sortDirection?: SortDirection | null;
  /** Called with a column's key when its (sortable) header is clicked.
   *  Omitting this — as every existing caller of Table does today —
   *  leaves headers exactly as plain, non-interactive text. */
  onSortChange?: (key: string) => void;
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
  sortKey = null,
  sortDirection = null,
  onSortChange,
}: TableProps<T>) {
  if (loading) {
    return <SkeletonTable rows={skeletonRows} cols={columns.length} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState message={emptyMessage} description={emptyDescription} icon={emptyIcon} action={emptyAction} />
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-ink/50 dark:border-white/10 dark:text-paper/50">
            {columns.map((col) => {
              const isSortable = Boolean(col.sortable && onSortChange);
              const isActive = isSortable && sortKey === col.key;

              return (
                <th
                  key={col.key}
                  className={`py-2 font-medium ${ALIGN_CLASS[col.align ?? 'right']} ${col.headerClassName ?? ''}`}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange!(col.key)}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-ink dark:hover:text-paper ${
                        col.align === 'left' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {col.header}
                      <SortIndicator direction={isActive ? sortDirection : null} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line/60 last:border-0 dark:border-white/10 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
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

// Lightweight chevron reused for the sort indicator — same stroke style
// (currentColor, strokeWidth 2) as the chevrons already hand-drawn in
// Pagination.tsx; no icon library is used anywhere in this project, so
// this follows the same pattern rather than introducing one. Points up
// by default (asc / neutral) and flips via CSS rotation for desc; dims
// to the same low-opacity convention used elsewhere (e.g. SearchInput's
// icon) when the column isn't the active sort.
function SortIndicator({ direction }: { direction: SortDirection | null }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`shrink-0 transition-transform ${direction === 'desc' ? 'rotate-180' : ''} ${
        direction ? 'opacity-100' : 'opacity-30'
      }`}
    >
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}
