import type { ReactNode } from 'react';
import { toPersianDigits } from '../lib/format';

// Client-side pagination — the backend list endpoints used here
// (`/students`, `/installments`) don't support page/limit query params
// today, so this slices an already-fetched array rather than requesting
// pages from the server. Swap for server-side paging later without
// touching callers if the backend adds it.
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
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
