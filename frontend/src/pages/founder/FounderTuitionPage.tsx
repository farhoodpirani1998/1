import { useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { Table, type TableColumn } from '../../components/Table';
import { SkeletonCards } from '../../components/Skeleton';
import { formatToman, toPersianDigits } from '../../lib/format';
import { useFounderSchoolTuition } from '../../hooks/useFounder';
import type { FounderTopDebtor } from '../../types/founder.types';
import { TuitionIcon, CheckIcon, ListIcon, AlertIcon, UsersIcon } from '../../components/icons/SchoolIcons';

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


