import { useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { toPersianDigits } from '../lib/format';
import { useToast } from '../lib/toast';
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useGrades,
  useCreateGrade,
} from '../hooks/useStudents';

// NOTE: "کلاس‌ها" و "انواع تخفیف" از این صفحه حذف شدند — بک‌اند فعلی هیچ
// ماژول Class یا DiscountType ندارد (فقط Grade + AcademicYear، و تخفیف
// به‌صورت مبلغ/دلیل آزاد روی هر TuitionPlan). اگر این مفاهیم لازم شوند،
// باید ابتدا در بک‌اند اضافه شوند.
export function SettingsPage() {
  return (
    <div className="fade-in">
      <h1 className="mb-6 text-xl font-bold text-ink">تنظیمات مدرسه</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AcademicYearsPanel />
        <GradesPanel />
      </div>
    </div>
  );
}

function AcademicYearsPanel() {
  const { showError } = useToast();
  const yearsQuery = useAcademicYears();
  const createAcademicYear = useCreateAcademicYear();
  const updateAcademicYear = useUpdateAcademicYear();
  const years = yearsQuery.data ?? [];

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createAcademicYear.mutate(
      { title, startDate: startDate || undefined, endDate: endDate || undefined, isCurrent },
      {
        onSuccess: () => {
          setTitle('');
          setStartDate('');
          setEndDate('');
          setIsCurrent(false);
        },
        onError: () => setError('ثبت سال تحصیلی با خطا مواجه شد'),
      },
    );
  }

  function setAsCurrent(id: string) {
    updateAcademicYear.mutate(
      { id, dto: { isCurrent: true } },
      { onError: () => showError('تغییر سال جاری با خطا مواجه شد') },
    );
  }

  return (
    <Card title="سال‌های تحصیلی">
      <form onSubmit={handleSubmit} className="mb-5 space-y-3">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان — مثلاً ۱۴۰۴-۱۴۰۵"
          className="input"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
          />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
          این سال، سال جاری باشد
        </label>
        {error && <div className="rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">{error}</div>}
        <button
          type="submit"
          disabled={createAcademicYear.isPending}
          className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {createAcademicYear.isPending ? 'در حال ذخیره...' : 'افزودن سال تحصیلی'}
        </button>
      </form>

      <ul className="divide-y divide-line">
        {years.map((y) => (
          <li key={y.id} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-ink">{y.title}</span>
            {y.isCurrent ? (
              <span className="rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-medium text-action">
                سال جاری
              </span>
            ) : (
              <button onClick={() => setAsCurrent(y.id)} className="text-xs text-action hover:underline">
                تعیین به‌عنوان سال جاری
              </button>
            )}
          </li>
        ))}
        {years.length === 0 && <li className="py-4 text-center text-sm text-ink/50">هنوز سالی ثبت نشده است.</li>}
      </ul>
    </Card>
  );
}

function GradesPanel() {
  const gradesQuery = useGrades();
  const createGrade = useCreateGrade();
  const grades = gradesQuery.data ?? [];

  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createGrade.mutate(
      { title },
      {
        onSuccess: () => setTitle(''),
        onError: () => setError('ثبت پایه با خطا مواجه شد'),
      },
    );
  }

  return (
    <Card title="پایه‌های تحصیلی">
      <form onSubmit={handleSubmit} className="mb-5 flex gap-2">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان پایه — مثلاً پایه هفتم"
          className="input"
        />
        <button
          type="submit"
          disabled={createGrade.isPending}
          className="shrink-0 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          افزودن
        </button>
      </form>

      {error && <div className="mb-3 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">{error}</div>}

      <ul className="divide-y divide-line">
        {grades.map((g, i) => (
          <li key={g.id} className="py-2.5 text-sm text-ink">
            {toPersianDigits(i + 1)}. {g.title}
          </li>
        ))}
        {grades.length === 0 && <li className="py-4 text-center text-sm text-ink/50">هنوز پایه‌ای ثبت نشده است.</li>}
      </ul>
    </Card>
  );
}
