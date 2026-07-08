import type { InstallmentStatus } from '../types/tuition.types';

const statusConfig: Record<InstallmentStatus, { label: string; className: string }> = {
  paid: { label: 'پرداخت‌شده', className: 'bg-paid/10 text-paid border-paid/30' },
  pending: { label: 'در انتظار', className: 'bg-ink/5 text-ink/70 border-ink/20' },
  overdue: { label: 'معوق', className: 'bg-overdue/10 text-overdue border-overdue/30' },
  partial: { label: 'پرداخت جزئی', className: 'bg-accent/15 text-accent-dark border-accent/40' },
  cancelled: { label: 'لغوشده', className: 'bg-ink/10 text-ink/50 border-ink/20 line-through' },
  deferred: { label: 'موکول‌شده', className: 'bg-navy/10 text-navy border-navy/30' },
  disputed: { label: 'مورد اختلاف', className: 'bg-overdue/10 text-overdue border-overdue/40' },
};

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-ink/5 text-ink/60 border-ink/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
