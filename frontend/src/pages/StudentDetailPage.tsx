import { useState, FormEvent, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonRows, SkeletonCards } from '../components/Skeleton';
import { InfoRow } from '../components/InfoRow';
import { RecordPaymentModal, PayableInstallment } from '../components/RecordPaymentModal';
import { VoidPaymentDialog } from '../components/VoidPaymentDialog';
import { FormError } from '../components/FormError';
import { formatToman, formatDate } from '../lib/format';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { hasPermission, Permission } from '../lib/permissions';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import type { StudentStatus, Student, Grade } from '../types/student.types';
import { useStudent } from '../hooks/useStudent';
import { useUpdateStudent, useGrades, useAcademicYears } from '../hooks/useStudents';
import { useStudentStatement } from '../hooks/useReports';
import { useCreateTuitionPlan, useGenerateInstallments } from '../hooks/useTuition';
import { useVoidPayment } from '../hooks/usePayments';

const statusLabels: Record<StudentStatus, string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

// Presentation-only status badge for a student profile — kept local to
// this page for the same reason as on StudentsPage: the shared
// <StatusBadge/> is typed for InstallmentStatus, not StudentStatus.
const statusBadgeClass: Record<StudentStatus, string> = {
  active: 'bg-paid/10 text-paid border-paid/25',
  withdrawn: 'bg-overdue/10 text-overdue border-overdue/25',
  graduated: 'bg-action-soft text-action border-action/25',
};

function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return (
    <span className={`badge ${statusBadgeClass[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

// Initial-letter avatar placeholder, derived from the student's existing
// fullName — no new/fake data, purely presentational.
function StudentAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action-soft text-xl font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

// Small label/value row used inside the Personal Information / Guardian
// cards — presentational only, replaces the inline "label: value" spans
// the page already rendered, just laid out more clearly per field.
// Full-page loading skeleton, shown while the statement (and/or student)
// query is still in flight. Built entirely from the existing Skeleton
// primitives — no new loading UI concepts introduced.
function StudentProfileSkeleton() {
  return (
    <div className="fade-in">
      <div className="mb-6 flex items-center gap-4">
        <div className="skeleton h-14 w-14 rounded-full" />
        <div className="flex-1">
          <div className="skeleton mb-2 h-5 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SkeletonRows rows={4} cols={2} />
        </Card>
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      </div>
      <SkeletonCards count={3} />
    </div>
  );
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const statementQuery = useStudentStatement(id);
  const studentQuery = useStudent(id);
  const updateStudent = useUpdateStudent();
  const voidPayment = useVoidPayment();

  const [payingInstallment, setPayingInstallment] = useState<PayableInstallment | null>(null);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<ParsedApiError | null>(null);
  const [expandedInstallment, setExpandedInstallment] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const statement = statementQuery.data ?? null;
  const student = studentQuery.data ?? null;

  function handleVoidPayment(reason: string) {
    if (!voidingPaymentId || !id) return;
    setVoidError(null);
    voidPayment.mutate(
      { paymentId: voidingPaymentId, reason, studentId: id },
      {
        onSuccess: () => {
          showSuccess('پرداخت لغو شد');
          setVoidingPaymentId(null);
        },
        onError: (err) => {
          setVoidError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  function handleStatusChange(status: StudentStatus) {
    if (!id) return;
    updateStudent.mutate(
      { id, dto: { status } },
      {
        onSuccess: () => showSuccess('وضعیت دانش‌آموز به‌روزرسانی شد'),
        onError: (err) => showError(getErrorMessage(err)),
      },
    );
  }

  if (statementQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="صورت‌حساب یافت نشد"
            description="ممکن است این دانش‌آموز حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }
  if (!statement) return <StudentProfileSkeleton />;

  // Role-gate mirrors backend's @Roles(); permission-gate mirrors backend's
  // @RequirePermission(PAYMENT_VOID) for the extra layer on top of role.
  const canVoidPayments = user?.role === 'school_admin' && hasPermission(user?.role, Permission.PAYMENT_VOID);
  const canEditStatus = user?.role === 'school_admin' || user?.role === 'staff';

  return (
    <div className="fade-in">
      <PageHeader
        title={statement.student.fullName}
        description="پروفایل و صورت‌حساب شهریه دانش‌آموز"
        actions={
          canEditStatus && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleStatusChange(e.target.value as StudentStatus);
                e.target.value = '';
              }}
              className="input w-auto text-sm"
            >
              <option value="">تغییر وضعیت...</option>
              <option value="active">فعال</option>
              <option value="withdrawn">انصرافی</option>
              <option value="graduated">فارغ‌التحصیل</option>
            </select>
          )
        }
      />

      {/* Profile header: avatar, name, grade, academic year, status */}
      <Card className="mb-6">
        {!student ? (
          <SkeletonRows rows={1} cols={3} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <StudentAvatar name={student.fullName} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-ink dark:text-paper">{student.fullName}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/60 dark:text-paper/60">
                <span>{student.grade?.title ?? 'بدون پایه'}</span>
                <span>{student.academicYear?.title ?? 'بدون سال تحصیلی'}</span>
                <StudentStatusBadge status={student.status} />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Grouped profile information */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="اطلاعات فردی"
          action={
            student &&
            canEditStatus &&
            !editingProfile && (
              <Button variant="ghost" size="sm" onClick={() => setEditingProfile(true)}>
                ویرایش پروفایل
              </Button>
            )
          }
        >
          {!student ? (
            <SkeletonRows rows={4} cols={2} />
          ) : editingProfile ? (
            <EditProfileForm
              student={student}
              onSaved={() => setEditingProfile(false)}
              onCancel={() => setEditingProfile(false)}
            />
          ) : (
            <div className="divide-y divide-line dark:divide-white/10">
              <InfoRow label="پایه تحصیلی" value={student.grade?.title ?? '—'} />
              <InfoRow label="سال تحصیلی" value={student.academicYear?.title ?? '—'} />
              <InfoRow label="کد ملی" value={student.nationalId ?? '—'} />
              <InfoRow
                label="تاریخ ثبت‌نام"
                value={student.enrollmentDate ? formatDate(student.enrollmentDate) : '—'}
              />
            </div>
          )}
        </Card>

        <Card title="والدین / سرپرست">
          {!student ? (
            <SkeletonRows rows={3} cols={2} />
          ) : student.guardian ? (
            <div className="divide-y divide-line dark:divide-white/10">
              <InfoRow label="نام و نام خانوادگی" value={student.guardian.fullName} />
              <InfoRow label="شماره تلفن" value={student.guardian.phone} />
              <InfoRow label="کد ملی" value={student.guardian.nationalId ?? '—'} />
            </div>
          ) : (
            <EmptyState message="اطلاعات والد/سرپرست ثبت نشده است." />
          )}
        </Card>
      </div>

      {/* Financial summary */}
      <SectionHeader title="خلاصه مالی" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="جمع شهریه" value={formatToman(statement.totals.totalDue)} />
        <StatCard label="پرداخت‌شده" value={formatToman(statement.totals.totalPaid)} accent="paid" />
        <StatCard label="باقیمانده" value={formatToman(statement.totals.totalRemaining)} accent="overdue" />
      </div>

      {/* Attendance / assessment: no backing data exists in the backend
          today (no attendance or assessment module/endpoints) — shown as
          empty-state placeholders rather than fabricated numbers. */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="خلاصه حضور و غیاب">
          <EmptyState
            message="سیستم حضور و غیاب هنوز راه‌اندازی نشده است."
            description="با فعال‌سازی این ماژول، خلاصه حضور و غیاب اینجا نمایش داده می‌شود."
          />
        </Card>
        <Card title="خلاصه ارزیابی">
          <EmptyState
            message="سیستم ارزیابی هنوز راه‌اندازی نشده است."
            description="با فعال‌سازی این ماژول، خلاصه نمرات و ارزیابی‌ها اینجا نمایش داده می‌شود."
          />
        </Card>
      </div>

      <SectionHeader title="برنامه شهریه و اقساط" />

      {statement.tuitionPlans.length === 0 && <CreateTuitionPlanForm studentId={statement.student.id} />}

      {statement.tuitionPlans.map((plan) =>
        plan.installments.length === 0 ? (
          <GenerateInstallmentsForm key={plan.id} planId={plan.id} finalAmount={plan.finalAmount} />
        ) : (
          <Card key={plan.id} title="اقساط" className="mb-4">
            <table className="ledger-lines w-full text-sm">
              <thead>
                <tr className="text-right text-ink/50">
                  <th className="py-1.5 font-medium">قسط</th>
                  <th className="py-1.5 font-medium">سررسید</th>
                  <th className="py-1.5 font-medium">مبلغ</th>
                  <th className="py-1.5 font-medium">پرداخت‌شده</th>
                  <th className="py-1.5 font-medium">وضعیت</th>
                  <th className="py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {plan.installments.map((inst) => (
                  <Fragment key={inst.id}>
                    <tr>
                      <td className="tabular py-1.5">{inst.installmentNumber}</td>
                      <td className="tabular py-1.5 text-ink/70">{formatDate(inst.dueDate)}</td>
                      <td className="tabular py-1.5">{formatToman(inst.amount)}</td>
                      <td className="tabular py-1.5 text-ink/70">{formatToman(inst.paidAmount)}</td>
                      <td className="py-1.5">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="py-1.5 text-left">
                        <div className="flex items-center justify-end gap-3">
                          {inst.payments.length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedInstallment(expandedInstallment === inst.id ? null : inst.id)
                              }
                              className="text-xs text-ink/50 hover:underline"
                            >
                              {expandedInstallment === inst.id ? 'بستن' : `${inst.payments.length} پرداخت`}
                            </button>
                          )}
                          {inst.status !== 'paid' && inst.status !== 'cancelled' && (
                            <button
                              onClick={() => setPayingInstallment(inst)}
                              className="text-xs font-medium text-action hover:underline"
                            >
                              ثبت پرداخت
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedInstallment === inst.id && (
                      <tr key={`${inst.id}-payments`}>
                        <td colSpan={6} className="bg-paper/60 px-3 py-2">
                          <table className="w-full text-xs">
                            <tbody>
                              {inst.payments.map((p) => (
                                <tr key={p.id} className="border-b border-line/50 last:border-0">
                                  <td className="py-1.5 text-ink/60">{formatDate(p.paidAt)}</td>
                                  <td className="tabular py-1.5">{formatToman(p.amount)}</td>
                                  <td className="py-1.5 text-ink/60">
                                    {p.paymentMethod === 'cash'
                                      ? 'نقدی'
                                      : p.paymentMethod === 'cheque'
                                        ? 'چک'
                                        : 'کارت‌به‌کارت'}
                                  </td>
                                  <td className="py-1.5 text-left">
                                    <div className="flex items-center justify-end gap-3">
                                      <button
                                        onClick={() =>
                                          navigate('/print/receipt', {
                                            state: {
                                              studentName: statement.student.fullName,
                                              installmentNumber: inst.installmentNumber,
                                              amount: p.amount,
                                              paymentMethod: p.paymentMethod ?? 'card_to_card',
                                              paidAt: p.paidAt,
                                            },
                                          })
                                        }
                                        className="text-ink/50 hover:underline"
                                      >
                                        چاپ رسید
                                      </button>
                                      {canVoidPayments && (
                                        <button
                                          onClick={() => setVoidingPaymentId(p.id)}
                                          className="text-overdue hover:underline"
                                        >
                                          لغو پرداخت
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>
        ),
      )}

      {payingInstallment && (
        <RecordPaymentModal
          installment={payingInstallment}
          studentId={statement.student.id}
          studentName={statement.student.fullName}
          onClose={() => setPayingInstallment(null)}
          onSaved={() => setPayingInstallment(null)}
        />
      )}

      {voidingPaymentId && (
        <VoidPaymentDialog
          error={voidError}
          onConfirm={handleVoidPayment}
          onCancel={() => {
            setVoidingPaymentId(null);
            setVoidError(null);
          }}
        />
      )}
    </div>
  );
}

function CreateTuitionPlanForm({ studentId }: { studentId: string }) {
  const { showSuccess, showError } = useToast();
  const academicYearsQuery = useAcademicYears();
  const createTuitionPlan = useCreateTuitionPlan();
  const academicYears = academicYearsQuery.data ?? [];

  const [academicYearId, setAcademicYearId] = useState(() => academicYears.find((y) => y.isCurrent)?.id ?? '');
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [discountReason, setDiscountReason] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  // academicYears loads async; default to the current year once it
  // arrives, same as the original useEffect-based version.
  if (!academicYearId && academicYears.length > 0) {
    const current = academicYears.find((y) => y.isCurrent);
    if (current) setAcademicYearId(current.id);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Backend has no discount-type catalog — discount is a free amount
    // + a free-text reason directly on CreateTuitionPlanDto.
    createTuitionPlan.mutate(
      {
        studentId,
        academicYearId,
        baseAmount,
        discountAmount: discountAmount === '' ? undefined : discountAmount,
        discountReason: discountReason || undefined,
      },
      {
        onSuccess: () => showSuccess('برنامه شهریه ثبت شد'),
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <Card title="این دانش‌آموز هنوز برنامه شهریه ندارد" className="mb-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">سال تحصیلی</label>
          <select required value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title} {y.isCurrent ? '(جاری)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">شهریه پایه (تومان)</label>
          <input
            type="number"
            required
            min={0}
            value={baseAmount}
            onChange={(e) => setBaseAmount(Number(e.target.value))}
            className="input tabular"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">مبلغ تخفیف (تومان، اختیاری)</label>
          <input
            type="number"
            min={0}
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value ? Number(e.target.value) : '')}
            className="input tabular"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">دلیل / توضیح تخفیف (اختیاری)</label>
          <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="input" />
        </div>

        <div className="col-span-full">
          <FormError error={error} />
          <button
            type="submit"
            disabled={createTuitionPlan.isPending}
            className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {createTuitionPlan.isPending ? 'در حال ذخیره...' : 'ثبت برنامه شهریه'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function GenerateInstallmentsForm({
  planId,
  finalAmount,
}: {
  planId: string;
  finalAmount: number;
}) {
  const { showSuccess, showError } = useToast();
  const generateInstallments = useGenerateInstallments();
  const [count, setCount] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [intervalDays, setIntervalDays] = useState(30);
  const [error, setError] = useState<ParsedApiError | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    generateInstallments.mutate(
      { planId, dto: { count, startDate, intervalDays } },
      {
        onSuccess: () => showSuccess('اقساط تولید شدند'),
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <Card title="برنامه شهریه ثبت شد — حالا اقساط را بساز" className="mb-4">
      <p className="mb-4 text-sm text-ink/60">مبلغ نهایی: {formatToman(finalAmount)}</p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">تعداد اقساط</label>
          <input
            type="number"
            required
            min={1}
            max={24}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="input tabular"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">تاریخ شروع</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">فاصله (روز)</label>
          <input
            type="number"
            required
            min={1}
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            className="input tabular"
          />
        </div>

        <div className="col-span-full">
          <FormError error={error} />
          <button
            type="submit"
            disabled={generateInstallments.isPending}
            className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generateInstallments.isPending ? 'در حال ساخت...' : 'تولید اقساط'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function EditProfileForm({
  student,
  onSaved,
  onCancel,
}: {
  student: Student;
  onSaved: (updated: Student) => void;
  onCancel: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const gradesQuery = useGrades();
  const updateStudent = useUpdateStudent();
  const grades: Grade[] = gradesQuery.data ?? [];
  const [gradeId, setGradeId] = useState(student.gradeId ?? '');
  const [error, setError] = useState<ParsedApiError | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // UpdateStudentDto only accepts gradeId/status/fullName — there is
    // no birthDate/address column on Student in the backend.
    updateStudent.mutate(
      { id: student.id, dto: { gradeId: gradeId || undefined } },
      {
        onSuccess: (updated) => {
          showSuccess('پروفایل به‌روزرسانی شد');
          onSaved(updated);
        },
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="input">
        <option value="">بدون پایه</option>
        {grades.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={updateStudent.isPending}
          className="flex-1 rounded-lg bg-action px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {updateStudent.isPending ? '...' : 'ذخیره'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-paper">
          انصراف
        </button>
      </div>
      <div className="sm:col-span-3">
        <FormError error={error} />
      </div>
    </form>
  );
}
