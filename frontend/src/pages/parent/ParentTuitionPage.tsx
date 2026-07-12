import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { InfoRow } from '../../components/InfoRow';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { formatToman, formatDate, toPersianDigits } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentTuition, useStudentInstallments } from '../../hooks/useParent';

// /parent/tuition — one tuition plan's breakdown (base/discount/final) for
// the selected child, plus a paid/remaining summary derived from their
// installments (same derivation ParentDashboardPage uses).
export function ParentTuitionPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const tuitionQuery = useStudentTuition(selectedStudent?.id);
  const installmentsQuery = useStudentInstallments(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="وضعیت شهریه" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="وضعیت شهریه" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const tuition = tuitionQuery.data;
  const installments = installmentsQuery.data ?? [];
  const paidAmount = installments.reduce((sum, i) => sum + i.paidAmount, 0);
  const remainingAmount = installments.reduce((sum, i) => sum + i.remainingAmount, 0);
  const progressPercent = tuition && tuition.finalAmount > 0 ? Math.min(100, Math.round((paidAmount / tuition.finalAmount) * 100)) : 0;

  const loading = tuitionQuery.isLoading || installmentsQuery.isLoading;

  return (
    <div className="fade-in">
      <PageHeader
        title="وضعیت شهریه"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      {loading ? (
        <SkeletonCards count={3} />
      ) : !tuition ? (
        <Card>
          <EmptyState
            message="برنامه شهریه‌ای برای این دانش‌آموز ثبت نشده است."
            description="پس از تعریف برنامه شهریه توسط مدرسه، جزئیات آن اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="شهریه پایه" value={formatToman(tuition.baseAmount)} />
            <StatCard label="تخفیف" value={formatToman(tuition.discountAmount)} accent="warning" />
            <StatCard label="مبلغ نهایی" value={formatToman(tuition.finalAmount)} accent="action" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="پرداخت‌شده" value={formatToman(paidAmount)} accent="paid" />
            <StatCard
              label="مانده حساب"
              value={formatToman(remainingAmount)}
              accent={remainingAmount > 0 ? 'overdue' : 'paid'}
            />
          </div>

          <div className="mt-6">
            <Card title="پیشرفت پرداخت">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink/60 dark:text-paper/60">
                  {formatToman(paidAmount)} از {formatToman(tuition.finalAmount)}
                </span>
                <span className="tabular font-medium text-ink dark:text-paper">{toPersianDigits(progressPercent)}٪</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-paid transition-[width] duration-500"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="جزئیات برنامه شهریه">
              <div className="divide-y divide-line dark:divide-white/10">
                <InfoRow label="سال تحصیلی" value={tuition.academicYearTitle} />
                <InfoRow label="تاریخ ثبت برنامه" value={formatDate(tuition.createdAt)} />
                <InfoRow label="تعداد اقساط" value={toPersianDigits(installments.length)} />
              </div>
            </Card>

            <Card title="اقدامات">
              <p className="mb-4 text-sm leading-relaxed text-ink/60 dark:text-paper/60">
                برای مشاهده جزئیات هر قسط و تاریخچه پرداخت‌ها، به صفحات مربوطه مراجعه کنید.
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/parent/installments" className="btn-secondary justify-center">
                  مشاهده اقساط
                </Link>
                <Link to="/parent/payments" className="btn-secondary justify-center">
                  تاریخچه پرداخت‌ها
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
