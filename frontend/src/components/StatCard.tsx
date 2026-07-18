import type { ReactNode } from 'react';
import { Card } from './Card';
import { splitCurrencyValue } from '../lib/format';

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

export type StatCardSize = 'md' | 'lg';

interface StatCardProps {
  label: string;
  value: string;
  accent?: StatAccent;
  icon?: ReactNode;
  /** Renders as a plain tinted block instead of a bordered Card — matches
   *  the compact "plain" stat boxes already used inside nested panels. */
  plain?: boolean;
  /** 'lg' promotes this card above the others in a grid of otherwise-equal
   *  StatCards — bigger value type, bigger icon, and a tinted background so
   *  the one number that matters most (e.g. a total outstanding balance)
   *  reads as the headline rather than blending in with three siblings. */
  size?: StatCardSize;
  className?: string;
}

const SIZE_LABEL_CLASS: Record<StatCardSize, string> = {
  md: 'text-sm text-ink/60 dark:text-paper/60',
  lg: 'text-sm font-medium text-ink/70 dark:text-paper/70',
};

const SIZE_VALUE_CLASS: Record<StatCardSize, string> = {
  md: 'mt-2 text-xl',
  lg: 'mt-2.5 text-3xl sm:text-4xl',
};

const SIZE_ICON_CLASS: Record<StatCardSize, string> = {
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
};


// Subtle tinted panel background for the 'lg' variant, one shade lighter
// than the icon badge so it reads as emphasis, not another status color.
const LG_PANEL_BG: Record<StatAccent, string> = {
  default: 'bg-ink/[0.025] dark:bg-white/[0.04]',
  action: 'bg-action-soft/60 dark:bg-action/10',
  paid: 'bg-paid-soft/60 dark:bg-paid/10',
  warning: 'bg-warning-soft/60 dark:bg-warning/10',
  overdue: 'bg-overdue-soft/60 dark:bg-overdue/10',
};

// Simple, single-number stat block: label + value (+ optional icon/accent).
// This is the shared version of the StatCard/StatBox that DashboardPage and
// ReportsPage each define locally today — those local copies are left as-is;
// this is available for new or updated call sites.
export function StatCard({
  label,
  value,
  accent = 'default',
  icon,
  plain = false,
  size = 'md',
  className = '',
}: StatCardProps) {
  const { amount, unit } = splitCurrencyValue(value);
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className={SIZE_LABEL_CLASS[size]}>{label}</div>
        <div className={`tabular truncate font-bold ${SIZE_VALUE_CLASS[size]} ${VALUE_COLOR[accent]}`}>
          {amount}
          {unit && (
            <span className="mr-1 text-[0.5em] font-normal text-ink/40 dark:text-paper/40">{unit}</span>
          )}
        </div>
      </div>
      {icon && (
        <div className={`flex shrink-0 items-center justify-center ${SIZE_ICON_CLASS[size]} ${ICON_BG[accent]}`}>
          {icon}
        </div>
      )}
    </div>
  );

  if (plain) {
    return <div className={`rounded-lg bg-paper p-4 dark:bg-white/5 ${className}`}>{content}</div>;
  }

  if (size === 'lg') {
    // Mirrors Card's own shell (border, radius, shadow) but swaps its
    // hardcoded bg-white for the accent tint directly in one class string —
    // appending an override class after Card's own bg-white risks losing
    // the cascade fight depending on Tailwind's generated rule order.
    return (
      <div
        className={`rounded-xl border border-line shadow-card transition-shadow duration-200 dark:border-white/10 ${LG_PANEL_BG[accent]} ${className}`}
      >
        <div className="p-5">{content}</div>
      </div>
    );
  }

  return <Card className={className}>{content}</Card>;
}
