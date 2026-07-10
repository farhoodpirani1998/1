import type { ReactNode } from 'react';
import { Card } from './Card';

export type StatAccent = 'default' | 'action' | 'paid' | 'warning' | 'overdue';

const VALUE_COLOR: Record<StatAccent, string> = {
  default: 'text-ink dark:text-paper',
  action: 'text-action',
  paid: 'text-paid',
  warning: 'text-warning',
  overdue: 'text-overdue',
};

const ICON_BG: Record<StatAccent, string> = {
  default: 'bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-paper/60',
  action: 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light',
  paid: 'bg-paid-soft text-paid dark:bg-paid/15',
  warning: 'bg-warning-soft text-warning dark:bg-warning/15',
  overdue: 'bg-overdue-soft text-overdue dark:bg-overdue/15',
};

interface StatCardProps {
  label: string;
  value: string;
  accent?: StatAccent;
  icon?: ReactNode;
  /** Renders as a plain tinted block instead of a bordered Card — matches
   *  the compact "plain" stat boxes already used inside nested panels. */
  plain?: boolean;
  className?: string;
}

// Simple, single-number stat block: label + value (+ optional icon/accent).
// This is the shared version of the StatCard/StatBox that DashboardPage and
// ReportsPage each define locally today — those local copies are left as-is;
// this is available for new or updated call sites.
export function StatCard({ label, value, accent = 'default', icon, plain = false, className = '' }: StatCardProps) {
  const content = (
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
  );

  if (plain) {
    return <div className={`rounded-lg bg-paper p-4 dark:bg-white/5 ${className}`}>{content}</div>;
  }

  return <Card className={className}>{content}</Card>;
}
