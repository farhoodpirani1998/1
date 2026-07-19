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
  /** Highlights the row whose rowKey matches this value (selected/active
   *  row styling). Optional — omit for tables with no selection concept. */
  selectedRowKey?: string | null;
  /** Sprint 3.3 — multi-row selection highlighting (checkbox-driven bulk
   *  selection), additive alongside `selectedRowKey` above which stays a
   *  single "active row" concept. Optional — omit for tables with no
   *  multi-select concept. Reuses the exact same highlight/hover/zebra
   *  classes as `selectedRowKey` so selected rows look identical either
   *  way. */
  selectedRowKeys?: Set<string>;
  /** 'compact' (default) renders the exact original spacing/classes this
   *  component always has, so every existing caller is pixel-identical.
   *  'comfortable' is an opt-in, more spacious management-table look
   *  (Sprint 3.2) — bigger header/cell padding, a tinted header row, and a
   *  slightly stronger hover/zebra treatment — for pages that want it. */
  density?: 'compact' | 'comfortable';
}

const ALIGN_CLASS: Record<NonNullable<TableColumn<unknown>['align']>, string> = {
  right: 'text-right',
  left: 'text-left',
  center: 'text-center',
};

const HEADER_ROW_CLASS = {
  compact: 'border-b border-line text-ink/50 dark:border-white/10 dark:text-paper/50',
  comfortable:
    'border-b border-line bg-ink/[0.02] text-[11px] font-semibold uppercase tracking-wide text-ink/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-paper/45',
} as const;

const HEADER_CELL_PADDING = { compact: 'py-2', comfortable: 'py-3' } as const;
const BODY_CELL_PADDING = { compact: 'py-3', comfortable: 'py-3.5' } as const;
const ZEBRA_CLASS = {
  compact: 'bg-ink/[0.015] dark:bg-white/[0.02]',
  comfortable: 'bg-ink/[0.02] dark:bg-white/[0.025]',
} as const;
const HOVER_CLASS = {
  compact: 'hover:bg-action/[0.06] dark:hover:bg-action/[0.12]',
  comfortable: 'hover:bg-action/[0.07] dark:hover:bg-action/[0.13]',
} as const;

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
  selectedRowKey = null,
  selectedRowKeys,
  density = 'compact',
}: TableProps<T>) {
  if (loading) {
    return <SkeletonTable rows={skeletonRows} cols={columns.length} density={density} />;
  }

  if (data.length === 0) {
    return <EmptyState message={emptyMessage} description={emptyDescription} icon={emptyIcon} action={emptyAction} />;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      {/* min-w-max: the table always renders at its natural content width.
          Without this, `w-full` on a narrow viewport forces every column to
          shrink, which wraps header labels onto 2+ lines and throws off
          vertical alignment between the header row and its data cells.
          The wrapping div's overflow-x-auto then does the actual scrolling. */}
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className={HEADER_ROW_CLASS[density]}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`whitespace-nowrap ${HEADER_CELL_PADDING[density]} ${
                  density === 'compact' ? 'font-medium' : ''
                } ${ALIGN_CLASS[col.align ?? 'right']} ${
                  stickyHeader ? 'sticky top-16 z-[5] bg-white dark:bg-navy-dark' : ''
                } ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const key = rowKey(row);
            const isSelected =
              (selectedRowKey != null && key === selectedRowKey) || (selectedRowKeys?.has(key) ?? false);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                aria-selected={selectedRowKey != null || selectedRowKeys ? isSelected : undefined}
                className={`border-b border-line/60 last:border-0 transition-colors duration-100 dark:border-white/10 ${
                  isSelected
                    ? 'bg-action-soft/70 dark:bg-action/15'
                    : i % 2 === 1
                      ? ZEBRA_CLASS[density]
                      : ''
                } ${onRowClick ? 'cursor-pointer' : ''} ${
                  isSelected ? '' : HOVER_CLASS[density]
                } ${isSelected && density === 'comfortable' ? 'border-r-2 border-r-action' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${BODY_CELL_PADDING[density]} ${ALIGN_CLASS[col.align ?? 'right']} ${col.cellClassName ?? ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
