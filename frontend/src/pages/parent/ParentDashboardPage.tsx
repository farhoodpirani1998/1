import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { SectionHeader } from '../../components/SectionHeader';
import { Table, type TableColumn } from '../../components/Table';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards, SkeletonRows } from '../../components/Skeleton';
import { formatToman, formatDate, paymentMethodLabels } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentTuition, useStudentInstallments, useStudentPayments, useMyAnnouncements } from '../../hooks/useParent';
import type { ParentPaymentView, ParentInstallmentView } from '../../types/parent.types';

// Installment states that still owe money — used to pick the "next
// installment" card (earliest upcoming due date among these statuses).
// Mirrors the same InstallmentStatus values StatusBadge already renders;
// not a new status concept.
const OUTSTANDING_STATUSES = new Set(['pending', 'partial', 'overdue']);

export function ParentDashboardPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();

  const tuitionQuery = useStudentTuition(selectedStudent?.id);
  const installmentsQuery = useStudentInstallments(selectedStudent?.id);
  const paymentsQuery = useStudentPayments(selectedStudent?.id);
  const announcementsQuery = useMyAnnouncements();

  if (studentsLoading) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  if (!selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  const installments = installmentsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const announcements = announcementsQuery.data ?? [];

  const totalTuition = tuitionQuery.data?.finalAmount ?? 0;
  const paidAmount = installments.reduce((sum, i) => sum + i.paidAmount, 0);
  const remainingBalance = installments.reduce((sum, i) => sum + i.remainingAmount, 0);

  const nextInstallment = [...installments]
    .filter((i) => OUTSTANDING_STATUSES.has(i.status))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const lastPayment = [...payments].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  )[0];

  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, 5);

  const latestAnnouncement = [...announcements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  const detailLoading = tuitionQuery.isLoading || installmentsQuery.isLoading || paymentsQuery.isLoading;

  const activityColumns: TableColumn<ParentPaymentView>[] = [
    { key: 'date', header: 'تاریخ', render: (p) => formatDate(p.paidAt) },
    {
      key: 'method',
      header: 'روش پرداخت',
      render: (p) => (p.paymentMethod ? paymentMethodLabels[p.paymentMethod] : '—'),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (p) => formatToman(p.amount),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="داشبورد"
        description={selectedStudent ? `${selectedStudent.fullName} — ${selectedStudent.school.name}` : undefined}
        actions={<StudentSwitcher className="w-56" />}
      />

      {detailLoading ? (
        <SkeletonCards count={4} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="نام دانش‌آموز" value={selectedStudent?.fullName ?? '—'} icon={<StudentIcon />} />
            <StatCard
              label="مدرسه"
              value={selectedStudent?.school.name ?? '—'}
              accent="action"
              icon={<SchoolIcon />}
            />
            <StatCard label="شهریه کل" value={formatToman(totalTuition)} accent="action" icon={<TuitionIcon />} />
            <StatCard label="مبلغ پرداخت‌شده" value={formatToman(paidAmount)} accent="paid" icon={<PaidIcon />} />
            <StatCard
              label="مانده حساب"
              value={formatToman(remainingBalance)}
              accent={remainingBalance > 0 ? 'overdue' : 'paid'}
              icon={<BalanceIcon />}
            />
            <NextInstallmentCard installment={nextInstallment} />
            <LastPaymentCard payment={lastPayment} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionHeader title="فعالیت‌های اخیر" description="آخرین پرداخت‌های ثبت‌شده" />
              <Card>
                <Table
                  columns={activityColumns}
                  data={recentPayments}
                  rowKey={(p) => p.id}
                  loading={paymentsQuery.isLoading}
                  emptyMessage="هنوز پرداختی ثبت نشده است."
                />
              </Card>
            </div>

            <div>
              <SectionHeader title="آخرین اطلاعیه مدرسه" />
              <Card>
                {announcementsQuery.isLoading ? (
                  <SkeletonRows rows={3} cols={1} />
                ) : latestAnnouncement ? (
                  <div>
                    <div className="mb-1 text-sm font-semibold text-ink dark:text-paper">
                      {latestAnnouncement.title}
                    </div>
                    <p className="mb-2 text-sm leading-relaxed text-ink/70 dark:text-paper/70">
                      {latestAnnouncement.message}
                    </p>
                    <div className="text-xs text-ink/40 dark:text-paper/40">
                      {formatDate(latestAnnouncement.createdAt)}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="اطلاعیه‌ای وجود ندارد" />
                )}
              </Card>

              <SectionHeader title="دسترسی سریع" className="mt-6" />
              <Card>
                <div className="flex flex-col gap-2">
                  <QuickAction to="/parent/tuition" label="مشاهده وضعیت شهریه" icon={<TuitionIcon />} />
                  <QuickAction to="/parent/installments" label="مشاهده اقساط" icon={<InstallmentsIcon />} />
                  <QuickAction to="/parent/payments" label="تاریخچه پرداخت‌ها" icon={<PaidIcon />} />
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NextInstallmentCard({ installment }: { installment: ParentInstallmentView | undefined }) {
  return (
    <Card>
      <div className="text-sm text-ink/60 dark:text-paper/60">قسط بعدی</div>
      {installment ? (
        <>
          <div className="tabular mt-2 text-xl font-bold text-ink dark:text-paper">
            {formatToman(installment.remainingAmount)}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-ink/45 dark:text-paper/45">{formatDate(installment.dueDate)}</span>
            <StatusBadge status={installment.status} />
          </div>
        </>
      ) : (
        <div className="mt-2 text-sm text-ink/40 dark:text-paper/40">قسط باقی‌مانده‌ای وجود ندارد</div>
      )}
    </Card>
  );
}

function LastPaymentCard({ payment }: { payment: ParentPaymentView | undefined }) {
  return (
    <Card>
      <div className="text-sm text-ink/60 dark:text-paper/60">آخرین پرداخت</div>
      {payment ? (
        <>
          <div className="tabular mt-2 text-xl font-bold text-paid">{formatToman(payment.amount)}</div>
          <div className="mt-2 text-xs text-ink/45 dark:text-paper/45">{formatDate(payment.paidAt)}</div>
        </>
      ) : (
        <div className="mt-2 text-sm text-ink/40 dark:text-paper/40">پرداختی ثبت نشده است</div>
      )}
    </Card>
  );
}

function QuickAction({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm text-ink transition-colors hover:border-action/30 hover:bg-action-soft dark:border-white/10 dark:text-paper dark:hover:bg-white/5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-action-soft text-action dark:bg-action/15 dark:text-action-light">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function StudentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6" />
    </svg>
  );
}

function TuitionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.5-2.2s2.5.8 2.5 2c0 1.4-1.2 1.8-2.5 2.2-1.3.4-2.5.8-2.5 2.2 0 1.2 1.2 2 2.5 2s2.5-.8 2.5-2.2" />
    </svg>
  );
}

function PaidIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function BalanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
}

function InstallmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 14h3" />
    </svg>
  );
}
