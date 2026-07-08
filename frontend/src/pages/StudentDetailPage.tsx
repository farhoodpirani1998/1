import { useState, FormEvent, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
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

  if (statementQuery.isError) return <div className="rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">صورت‌حساب یافت نشد</div>;
  if (!statement) return <div className="text-sm text-ink/50">در حال بارگذاری...</div>;

  // Role-gate mirrors backend's @Roles(); permission-gate mirrors backend's
  // @RequirePermission(PAYMENT_VOID) for the extra layer on top of role.
  const canVoidPayments = user?.role === 'school_admin' && hasPermission(user?.role, Permission.PAYMENT_VOID);
  const canEditStatus = user?.role === 'school_admin' || user?.role === 'staff';

  return (
    <div className="fade-in">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-xl font-bold text-ink">{statement.student.fullName}</h1>
          <p className="text-sm text-ink/50">صورت‌حساب شهریه</p>
        </div>
        {canEditStatus && (
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
        )}
      </div>

      {student && (
        <Card className="mb-6">
          {editingProfile ? (
            <EditProfileForm
              student={student}
              onSaved={() => setEditingProfile(false)}
              onCancel={() => setEditingProfile(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-ink/70">
                <span>
                  پایه: <span className="text-ink">{student.grade?.title ?? '—'}</span>
                </span>
                <span>
                  والد: <span className="text-ink">{student.guardian?.fullName ?? '—'}</span> ({student.guardian?.phone ?? '—'})
                </span>
                <span>
                  کد ملی: <span className="tabular text-ink">{student.nationalId ?? '—'}</span>
                </span>
                <span>
                  تاریخ ثبت‌نام:{' '}
                  <span className="tabular text-ink">
                    {student.enrollmentDate ? formatDate(student.enrollmentDate) : '—'}
                  </span>
                </span>
              </div>
              {canEditStatus && (
                <button onClick={() => setEditingProfile(true)} className="shrink-0 text-xs font-medium text-action hover:underline">
                  ویرایش پروفایل
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TotalCard label="جمع شهریه" value={statement.totals.totalDue} />
        <TotalCard label="پرداخت‌شده" value={statement.totals.totalPaid} accent="paid" />
        <TotalCard label="باقیمانده" value={statement.totals.totalRemaining} accent="overdue" />
      </div>

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

function TotalCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'paid' | 'overdue';
}) {
  const colorClass = accent ? { paid: 'text-paid', overdue: 'text-overdue' }[accent] : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="text-sm text-ink/60">{label}</div>
      <div className={`tabular mt-2 text-xl font-bold ${colorClass}`}>{formatToman(value)}</div>
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
