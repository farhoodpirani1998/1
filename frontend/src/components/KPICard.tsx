import type { ReactNode } from 'react';
import { Card } from './Card';
import { toPersianDigits } from '../lib/format';

export type KPIAccent = 'action' | 'paid' | 'warning' | 'overdue';

const ICON_BG: Record<KPIAccent, string> = {
  action: 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light',
  paid: 'bg-paid-soft text-paid dark:bg-paid/15',
  warning: 'bg-warning-soft text-warning dark:bg-warning/15',
  overdue: 'bg-overdue-soft text-overdue dark:bg-overdue/15',
};

const BAR_COLOR: Record<KPIAccent, string> = {
  action: 'bg-action',
  paid: 'bg-paid',
  warning: 'bg-warning',
  overdue: 'bg-overdue',
};

interface KPICardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: KPIAccent;
  subtitle?: string;
  /** 0–100 — renders a progress bar toward a target (e.g. collection rate). */
  progress?: number;
  className?: string;
}

// Heavier-weight KPI display than StatCard: icon badge + big value +
// subtitle + optional progress bar (e.g. "٪۷۲ از هدف وصول این ماه").
// Intended for the one or two headline numbers on a dashboard, not for
// dense grids of small stats (use StatCard/MetricCard for those).
export function KPICard({ label, value, icon, accent = 'action', subtitle, progress, className = '' }: KPICardProps) {
  const clampedProgress = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));

  return (
    <Card className={className}>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ICON_BG[accent]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm text-ink/60 dark:text-paper/60">{label}</div>
          <div className="tabular truncate text-2xl font-bold text-ink dark:text-paper">{value}</div>
        </div>
      </div>

      {clampedProgress !== undefined && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
            <div
              className={`h-full rounded-full ${BAR_COLOR[accent]} transition-[width] duration-300`}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-ink/45 dark:text-paper/45">
            {toPersianDigits(Math.round(clampedProgress))}٪ {subtitle ?? ''}
          </div>
        </div>
      )}

      {clampedProgress === undefined && subtitle && (
        <div className="mt-3 text-xs text-ink/45 dark:text-paper/45">{subtitle}</div>
      )}
    </Card>
  );
}
