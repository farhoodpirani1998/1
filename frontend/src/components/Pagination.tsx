import type { ReactNode } from 'react';
import { toPersianDigits } from '../lib/format';

interface PaginationProps {
  page: number;
  onChange: (page: number) => void;
  /** Total page count — used for the numbered mode (client-side slicing
   *  over an already-fetched array, e.g. StudentsPage/ReportsPage). */
  pageCount?: number;
  /** For server-paginated lists where the backend returns a plain array
   *  with no total count (e.g. FounderStudentsPage's /founder/schools/:id/students) —
   *  pass whether the current page came back full, and this renders a
   *  simple prev/"صفحه N"/next control instead of numbered buttons, sharing
   *  the same PageButton styling so both modes look like one component. */
  hasNextPage?: boolean;
}

// Client-side pagination by default — the backend list endpoints used here
// (`/students`, `/installments`) don't support page/limit query params
// today, so this slices an already-fetched array rather than requesting
// pages from the server. Pass `hasNextPage` instead of `pageCount` for
// server-paginated lists that don't expose a total (see FounderStudentsPage).
export function Pagination({ page, pageCount, hasNextPage, onChange }: PaginationProps) {
  if (pageCount !== undefined) {
    if (pageCount <= 1) return null;

    const pageNumbers = getPageWindow(page, pageCount);

    return (
      <div className="mt-4 flex items-center justify-center gap-1.5">
        <PageButton
          label="قبلی"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 6-6 6 6 6" />
            </svg>
          }
        />

        <div className="flex items-center gap-1">
          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1.5 text-sm text-ink/35 dark:text-paper/35">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`tabular h-8 min-w-[2rem] rounded-lg px-2 text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-action text-white shadow-[0_1px_2px_rgba(37,99,235,0.35)]'
                    : 'text-ink/60 hover:bg-paper dark:text-paper/60 dark:hover:bg-white/10'
                }`}
              >
                {toPersianDigits(p)}
              </button>
            ),
          )}
        </div>

        <PageButton
          label="بعدی"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 6 6 6-6 6" />
            </svg>
          }
        />
      </div>
    );
  }

  // Simple mode: no known total, just prev/next driven by hasNextPage.
  if (page <= 1 && !hasNextPage) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <PageButton
        label="قبلی"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 6-6 6 6 6" />
          </svg>
        }
      />
      <span className="tabular text-sm text-ink/60 dark:text-paper/60">صفحه {toPersianDigits(page)}</span>
      <PageButton
        label="بعدی"
        disabled={!hasNextPage}
        onClick={() => onChange(page + 1)}
        icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 6 6 6-6 6" />
          </svg>
        }
      />
    </div>
  );
}

function PageButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-sm text-ink/70 transition-colors hover:bg-paper disabled:pointer-events-none disabled:opacity-35 dark:border-white/15 dark:text-paper/70 dark:hover:bg-white/10"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// Builds a compact window of page numbers around the current page, with
// the first/last page always visible and an ellipsis for the gap —
// e.g. 1 … 4 5 [6] 7 8 … 20 instead of rendering all 20 buttons.
function getPageWindow(page: number, pageCount: number): (number | 'ellipsis')[] {
  const delta = 1;
  const range: (number | 'ellipsis')[] = [];
  const start = Math.max(2, page - delta);
  const end = Math.min(pageCount - 1, page + delta);

  range.push(1);
  if (start > 2) range.push('ellipsis');
  for (let i = start; i <= end; i++) range.push(i);
  if (end < pageCount - 1) range.push('ellipsis');
  if (pageCount > 1) range.push(pageCount);

  return range;
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
