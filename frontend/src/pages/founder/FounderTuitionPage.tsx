import { useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { Table, type TableColumn } from '../../components/Table';
import { SkeletonCards } from '../../components/Skeleton';
import { formatToman, toPersianDigits } from '../../lib/format';
import { useFounderSchoolTuition } from '../../hooks/useFounder';
import type { FounderTopDebtor } from '../../types/founder.types';

export function FounderTuitionPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const tuitionQuery = useFounderSchoolTuition(schoolId);
  const data = tuitionQuery.data;
  const loading = tuitionQuery.isLoading;
  const error = tuitionQuery.isError;

  const debtorColumns: TableColumn<FounderTopDebtor>[] = [
    { key: 'student', header: 'دانش‌آموز', render: (d) => d.studentFullName },
    {
      key: 'balance',
      header: 'مانده بدهی',
      align: 'left',
      cellClassName: 'tabular font-medium text-overdue',
      render: (d) => formatToman(d.outstandingBalance),
    },
  ];

  if (error) {
    return <div className="rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">خطا در بارگذاری خلاصه شهریه</div>;
  }

  return (
    <div>
      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatCard
            size="lg"
            label="باقی‌مانده کل"
            value={formatToman(data?.totalUnpaid ?? 0)}
            accent="warning"
            icon={<ListIcon />}
            className="lg:col-span-1"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
            <StatCard label="کل شهریه" value={formatToman(data?.totalTuition ?? 0)} icon={<TuitionIcon />} />
            <StatCard label="دریافت‌شده" value={formatToman(data?.totalPaid ?? 0)} accent="paid" icon={<CheckIcon />} />
            <StatCard label="مبلغ معوق" value={formatToman(data?.overdue.totalOverdueAmount ?? 0)} accent="overdue" icon={<AlertIcon />} />
          </div>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <SkeletonCards count={2} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="تعداد اقساط معوق" value={toPersianDigits(data?.overdue.overdueInstallmentCount ?? 0)} icon={<ListIcon />} />
            <StatCard label="دانش‌آموزان بدهکار" value={toPersianDigits(data?.overdue.overdueStudentCount ?? 0)} icon={<UsersIcon />} />
          </div>
        )}
      </div>

      <Card title="بدهکاران برتر" className="mt-6">
        <Table
          columns={debtorColumns}
          data={data?.topDebtors ?? []}
          rowKey={(d) => d.studentId}
          loading={loading}
          skeletonRows={6}
          emptyMessage="هیچ دانش‌آموز بدهکاری وجود ندارد."
        />
      </Card>
    </div>
  );
}

function TuitionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M8 15h3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 14c2.5.3 4.5 2.3 4.5 4.8" />
    </svg>
  );
}
