import type { ReactNode } from 'react';

interface WorkspaceHeaderProps {
  title: string;
  /** Short descriptive line under the title. */
  subtitle?: string;
  /** Live count badge (e.g. "۴۲ دانش‌آموز") — pass the already-computed
   *  label; this component renders no query of its own. Omit for
   *  workspaces with no meaningful single count. */
  countLabel?: ReactNode;
  countIcon?: ReactNode;
  countAriaLabel?: string;
  /** Primary call-to-action (e.g. "+ دانش‌آموز جدید"). */
  primaryAction?: ReactNode;
  /** Secondary, page-level actions (e.g. a link to a related view).
   *  Rendered before the primary action, same order as the Student
   *  Workspace's original header. */
  secondaryActions?: ReactNode;
  className?: string;
}

// Sprint A2.1 introduced this structured "card" header for the Student
// Workspace (title + live count badge + subtitle + primary/secondary
// actions), replacing the plainer shared <PageHeader/>. Sprint A3.1 reuses
// it verbatim for the Teacher Workspace instead of hand-rolling the same
// markup a second time — extracted here so both (and any future workspace
// page) stay pixel-identical and only need to change props, not markup.
export function WorkspaceHeader({
  title,
  subtitle,
  countLabel,
  countIcon,
  countAriaLabel,
  primaryAction,
  secondaryActions,
  className = '',
}: WorkspaceHeaderProps) {
  return (
    <div
      className={`mb-6 rounded-xl border border-line bg-white p-5 shadow-card dark:border-white/10 dark:bg-white/[0.03] sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-ink dark:text-paper">{title}</h1>
            {countLabel != null && (
              <span
                className="badge border-line bg-ink/5 text-ink/60 dark:border-white/10 dark:bg-white/10 dark:text-paper/60"
                aria-label={countAriaLabel}
              >
                {countIcon}
                {countLabel}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1.5 text-sm text-ink/55 dark:text-paper/55">{subtitle}</p>}
        </div>
        {(secondaryActions || primaryAction) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
