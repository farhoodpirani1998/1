import type { InstallmentStatus } from '../types/tuition.types';

const statusConfig: Record<InstallmentStatus, { label: string; className: string }> = {
  paid: { label: 'پرداخت‌شده', className: 'bg-paid/10 text-paid border-paid/25' },
  pending: { label: 'در انتظار', className: 'bg-warning/10 text-warning border-warning/25' },
  overdue: { label: 'معوق', className: 'bg-overdue/10 text-overdue border-overdue/25' },
  partial: { label: 'پرداخت جزئی', className: 'bg-warning/10 text-warning border-warning/25' },
  cancelled: { label: 'لغوشده', className: 'bg-ink/5 text-ink/45 border-ink/15 line-through' },
  deferred: { label: 'موکول‌شده', className: 'bg-action-soft text-action border-action/25' },
  disputed: { label: 'مورد اختلاف', className: 'bg-overdue/10 text-overdue border-overdue/30' },
};

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-ink/5 text-ink/60 border-ink/20',
  };
  return (
    <span className={`badge ${config.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
