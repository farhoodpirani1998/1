import type { ReactNode } from 'react';
import { Card } from './Card';
import { toPersianDigits } from '../lib/format';

export type MetricAccent = 'default' | 'action' | 'paid' | 'warning' | 'overdue';
export type TrendDirection = 'up' | 'down' | 'flat';
/** How to color the trend: 'good'/'bad' let the caller decide (e.g. overdue
 *  amount going "up" is bad, paid amount going "up" is good), independent of
 *  arrow direction. Defaults to 'up' = good when not specified. */
export type TrendTone = 'good' | 'bad' | 'neutral';

interface Trend {
  /** Percentage change, e.g. 12.5 for +12.5% — sign is derived from `direction`. */
  value: number;
  direction: TrendDirection;
  tone?: TrendTone;
  /** e.g. "نسبت به ماه قبل" */
  label?: string;
}

const VALUE_COLOR: Record<MetricAccent, string> = {
  default: 'text-ink dark:text-paper',
  action: 'text-action',
  paid: 'text-paid',
  warning: 'text-warning',
  overdue: 'text-overdue',
};

const ICON_BG: Record<MetricAccent, string> = {
  default: 'bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-paper/60',
  action: 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light',
  paid: 'bg-paid-soft text-paid dark:bg-paid/15',
  warning: 'bg-warning-soft text-warning dark:bg-warning/15',
  overdue: 'bg-overdue-soft text-overdue dark:bg-overdue/15',
};

const TREND_COLOR: Record<TrendTone, string> = {
  good: 'text-paid bg-paid-soft dark:bg-paid/15',
  bad: 'text-overdue bg-overdue-soft dark:bg-overdue/15',
  neutral: 'text-ink/50 bg-ink/5 dark:text-paper/50 dark:bg-white/10',
};

function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'flat') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d={direction === 'up' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} />
    </svg>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  accent?: MetricAccent;
  icon?: ReactNode;
  trend?: Trend;
  className?: string;
}

// Like StatCard, but with a trend pill (▲/▼ + %) — for dashboard/report
// comparisons against a previous period. Trend color is driven by `tone`
// ('good'/'bad'/'neutral'), not the arrow direction, since "up" isn't
// always positive (e.g. overdue amount increasing).
export function MetricCard({ label, value, accent = 'default', icon, trend, className = '' }: MetricCardProps) {
  const tone: TrendTone = trend?.tone ?? (trend?.direction === 'down' ? 'bad' : trend?.direction === 'up' ? 'good' : 'neutral');

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-ink/60 dark:text-paper/60">{label}</div>
          <div className={`tabular mt-2 truncate text-xl font-bold ${VALUE_COLOR[accent]}`}>{value}</div>
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ICON_BG[accent]}`}>
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TREND_COLOR[tone]}`}>
            <TrendArrow direction={trend.direction} />
            {toPersianDigits(Math.abs(trend.value).toFixed(1))}٪
          </span>
          {trend.label && <span className="text-xs text-ink/40 dark:text-paper/40">{trend.label}</span>}
        </div>
      )}
    </Card>
  );
}
