// SkeletonRows and SkeletonCards keep their exact original props/signature
// — every existing caller (DashboardPage, ReportsPage, StudentsPage, etc.)
// keeps working unchanged. Spinner and SkeletonTable are additive, for new
// or updated loading states.

export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-white p-5 shadow-card dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="skeleton mb-3 h-4 w-24" />
          <div className="skeleton h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

// A closer approximation of a real data table while loading: a dimmed
// header row plus skeleton body rows, so tables don't visually "jump"
// once data arrives (column proportions stay roughly the same).
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-3 flex gap-4 border-b border-line pb-2 dark:border-white/10">
        {Array.from({ length: cols }, (_, c) => (
          <div key={c} className="skeleton h-3 flex-1 opacity-60" />
        ))}
      </div>
      <SkeletonRows rows={rows} cols={cols} />
    </div>
  );
}

// Small inline spinner for buttons / inline "loading…" states that don't
// warrant a full skeleton (e.g. a refresh action, an inline save indicator).
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
