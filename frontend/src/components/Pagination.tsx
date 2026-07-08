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
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-40"
      >
        قبلی
      </button>
      <span className="tabular text-ink/60">
        {toPersianDigits(page)} از {toPersianDigits(pageCount)}
      </span>
      <button
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-40"
      >
        بعدی
      </button>
    </div>
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
