import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { Table, type TableColumn } from '../../components/Table';
import { formatToman, formatDate, toPersianDigits, paymentMethodLabels } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentPayments } from '../../hooks/useParent';
import type { ParentPaymentView } from '../../types/parent.types';

// /parent/payments — full payment history for the selected child.
//
// NOTE on the "Status" column: ParentPaymentViewDto has no status field —
// GET /parent/students/:id/payments already excludes voided payments
// server-side (see parent.service.ts), so every row this page ever
// receives is, by construction, a completed payment. The badge below
// reflects that fact rather than reading a field that doesn't exist.
export function ParentPaymentsPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const paymentsQuery = useStudentPayments(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="تاریخچه پرداخت‌ها" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="تاریخچه پرداخت‌ها" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const payments = [...(paymentsQuery.data ?? [])].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const lastPayment = payments[0];

  const columns: TableColumn<ParentPaymentView>[] = [
    { key: 'date', header: 'تاریخ', render: (p) => formatDate(p.paidAt) },
    {
      key: 'amount',
      header: 'مبلغ',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (p) => formatToman(p.amount),
    },
    {
      key: 'method',
      header: 'روش پرداخت',
      render: (p) => (p.paymentMethod ? paymentMethodLabels[p.paymentMethod] : '—'),
    },
    {
      key: 'receipt',
      header: 'کد پیگیری',
      cellClassName: 'tabular',
      render: (p) => (p.receiptNumber ? toPersianDigits(p.receiptNumber) : '—'),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: () => (
        <span className="badge border-paid/25 bg-paid/10 text-paid">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          تکمیل‌شده
        </span>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="تاریخچه پرداخت‌ها"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="مجموع پرداخت‌ها" value={formatToman(totalPaid)} accent="paid" />
        <StatCard label="تعداد پرداخت‌ها" value={toPersianDigits(payments.length)} />
        <StatCard label="آخرین پرداخت" value={lastPayment ? formatDate(lastPayment.paidAt) : '—'} />
      </div>

      <div className="mt-6">
        <Card title="لیست پرداخت‌ها">
          <Table
            columns={columns}
            data={payments}
            rowKey={(p) => p.id}
            loading={paymentsQuery.isLoading}
            emptyMessage="هنوز پرداختی برای این دانش‌آموز ثبت نشده است."
          />
        </Card>
      </div>
    </div>
  );
}
