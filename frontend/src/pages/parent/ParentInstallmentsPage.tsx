import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { Table, type TableColumn } from '../../components/Table';
import { formatToman, formatDate, toPersianDigits } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentInstallments } from '../../hooks/useParent';
import type { ParentInstallmentView } from '../../types/parent.types';

// /parent/installments — full installment list for the selected child.
// The "پرداخت" button is intentionally disabled: ParentController has no
// payment-initiation endpoint today (only school_admin/accountant record
// payments, via RecordPaymentModal). Wiring a real "pay online" flow
// would mean inventing a backend contract that doesn't exist — out of
// scope per project rules. The button is left visible-but-disabled so
// the affordance is in place for when that endpoint exists.
export function ParentInstallmentsPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const installmentsQuery = useStudentInstallments(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="اقساط" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="اقساط" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const installments = [...(installmentsQuery.data ?? [])].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const paidCount = installments.filter((i) => i.status === 'paid').length;
  const overdueCount = installments.filter((i) => i.status === 'overdue').length;
  const remainingTotal = installments.reduce((sum, i) => sum + i.remainingAmount, 0);

  const columns: TableColumn<ParentInstallmentView>[] = [
    {
      key: 'number',
      header: 'شماره قسط',
      render: (i) => toPersianDigits(i.installmentNumber),
    },
    {
      key: 'dueDate',
      header: 'سررسید',
      render: (i) => formatDate(i.dueDate),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      align: 'left',
      cellClassName: 'tabular font-medium',
      render: (i) => formatToman(i.amount),
    },
    {
      key: 'remaining',
      header: 'مانده',
      align: 'left',
      cellClassName: 'tabular font-medium text-overdue',
      render: (i) => (i.remainingAmount > 0 ? formatToman(i.remainingAmount) : '—'),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: 'pay',
      header: '',
      align: 'left',
      render: (i) => (
        <Button variant="secondary" size="sm" disabled title="پرداخت آنلاین به‌زودی فعال می‌شود">
          {i.status === 'paid' ? 'پرداخت‌شده' : 'پرداخت'}
        </Button>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="اقساط"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="تعداد اقساط" value={toPersianDigits(installments.length)} />
        <StatCard label="اقساط پرداخت‌شده" value={toPersianDigits(paidCount)} accent="paid" />
        <StatCard
          label="اقساط معوق"
          value={toPersianDigits(overdueCount)}
          accent={overdueCount > 0 ? 'overdue' : 'default'}
        />
      </div>

      <div className="mt-6">
        <Card
          title="لیست اقساط"
          action={
            remainingTotal > 0 ? (
              <span className="text-xs text-ink/50 dark:text-paper/50">
                مجموع مانده: <span className="tabular font-medium text-overdue">{formatToman(remainingTotal)}</span>
              </span>
            ) : undefined
          }
        >
          <Table
            columns={columns}
            data={installments}
            rowKey={(i) => i.id}
            loading={installmentsQuery.isLoading}
            emptyMessage="قسطی برای این دانش‌آموز ثبت نشده است."
          />
        </Card>
      </div>
    </div>
  );
}
