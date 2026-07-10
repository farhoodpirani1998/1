import { useState, FormEvent } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SectionHeader } from '../components/SectionHeader';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Table, type TableColumn } from '../components/Table';
import { toPersianDigits, formatDate } from '../lib/format';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from '../components/FormError';
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useGrades,
  useCreateGrade,
} from '../hooks/useStudents';
import type { AcademicYear, Grade } from '../types/student.types';

// NOTE: "کلاس‌ها" و "انواع تخفیف" از این صفحه حذف شدند — بک‌اند فعلی هیچ
// ماژول Class یا DiscountType ندارد (فقط Grade + AcademicYear، و تخفیف
// به‌صورت مبلغ/دلیل آزاد روی هر TuitionPlan). اگر این مفاهیم لازم شوند،
// باید ابتدا در بک‌اند اضافه شوند.
export function SettingsPage() {
  return (
    <div className="fade-in">
      <PageHeader title="تنظیمات مدرسه" description="مدیریت سال‌های تحصیلی و پایه‌های تحصیلی مدرسه" />
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
  const [error, setError] = useState<ParsedApiError | null>(null);

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
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  function setAsCurrent(id: string) {
    updateAcademicYear.mutate(
      { id, dto: { isCurrent: true } },
      { onError: (err) => showError(getErrorMessage(err)) },
    );
  }

  const columns: TableColumn<AcademicYear>[] = [
    {
      key: 'title',
      header: 'عنوان',
      render: (y) => <span className="font-medium text-ink dark:text-paper">{y.title}</span>,
    },
    {
      key: 'range',
      header: 'بازه',
      render: (y) =>
        y.startDate || y.endDate ? (
          <span className="text-ink/60 dark:text-paper/60">
            {y.startDate ? formatDate(y.startDate) : '—'} تا {y.endDate ? formatDate(y.endDate) : '—'}
          </span>
        ) : (
          <span className="text-ink/35 dark:text-paper/35">—</span>
        ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      align: 'left',
      render: (y) =>
        y.isCurrent ? (
          <span className="rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-medium text-action">
            سال جاری
          </span>
        ) : (
          <button
            onClick={() => setAsCurrent(y.id)}
            disabled={updateAcademicYear.isPending}
            className="text-xs text-action hover:underline disabled:opacity-50"
          >
            تعیین به‌عنوان سال جاری
          </button>
        ),
    },
  ];

  return (
    <Card title="سال‌های تحصیلی">
      <SectionHeader title="افزودن سال تحصیلی جدید" className="mb-4" />
      <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg bg-paper/60 p-4 dark:bg-white/[0.03]">
        <Input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان — مثلاً ۱۴۰۴-۱۴۰۵"
          label="عنوان سال تحصیلی"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            label="تاریخ شروع"
          />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} label="تاریخ پایان" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/70 dark:text-paper/70">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="h-4 w-4 rounded border-line text-action focus:ring-action/40"
          />
          این سال، سال جاری باشد
        </label>
        <FormError error={error} />
        <Button type="submit" loading={createAcademicYear.isPending}>
          {createAcademicYear.isPending ? 'در حال ذخیره...' : 'افزودن سال تحصیلی'}
        </Button>
      </form>

      <SectionHeader title="فهرست سال‌های تحصیلی" className="mb-3" />
      <Table
        columns={columns}
        data={years}
        rowKey={(y) => y.id}
        loading={yearsQuery.isLoading}
        emptyMessage="هنوز سالی ثبت نشده است."
      />
    </Card>
  );
}

function GradesPanel() {
  const gradesQuery = useGrades();
  const createGrade = useCreateGrade();
  const grades = gradesQuery.data ?? [];

  const [title, setTitle] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);
  const { showError } = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createGrade.mutate(
      { title },
      {
        onSuccess: () => setTitle(''),
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  const columns: TableColumn<Grade>[] = [
    {
      key: 'index',
      header: '#',
      cellClassName: 'text-ink/45 dark:text-paper/45',
      render: (g) => toPersianDigits(grades.findIndex((x) => x.id === g.id) + 1),
    },
    {
      key: 'title',
      header: 'عنوان پایه',
      render: (g) => <span className="font-medium text-ink dark:text-paper">{g.title}</span>,
    },
  ];

  return (
    <Card title="پایه‌های تحصیلی">
      <SectionHeader title="افزودن پایه جدید" className="mb-4" />
      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-3 rounded-lg bg-paper/60 p-4 dark:bg-white/[0.03] sm:flex-row sm:items-end"
      >
        <Input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان پایه — مثلاً پایه هفتم"
          label="عنوان پایه"
          containerClassName="flex-1"
        />
        <Button type="submit" loading={createGrade.isPending} className="shrink-0">
          افزودن
        </Button>
      </form>

      <FormError error={error} />

      <SectionHeader title="فهرست پایه‌های تحصیلی" className="mb-3" />
      <Table
        columns={columns}
        data={grades}
        rowKey={(g) => g.id}
        loading={gradesQuery.isLoading}
        emptyMessage="هنوز پایه‌ای ثبت نشده است."
      />
    </Card>
  );
}
