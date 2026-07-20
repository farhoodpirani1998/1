import { useState, useEffect, FormEvent } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SectionHeader } from '../components/SectionHeader';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { PersianDatePicker } from '../components/PersianDatePicker';
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
  useUpdateGrade,
  useDeleteGrade,
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
} from '../hooks/useStudents';
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from '../hooks/useSubjects';
import { useSchoolSettings, useUpdateSchoolSettings } from '../hooks/useSchoolSettings';
import type { AcademicYear, Grade, SchoolClass } from '../types/student.types';
import type { Subject } from '../types/teacher.types';

// NOTE: "انواع تخفیف" is still not a module the backend has (تخفیف is a
// free amount/reason on each TuitionPlan, not its own entity) — that part
// of the original note above still applies. "کلاس‌ها" no longer does:
// the backend now has a Class module (grade+academicYear-scoped sections)
// added specifically to fix the bug where two sections of one grade had
// no way to be told apart. See ClassesPanel below.
export function SettingsPage() {
  return (
    <div className="fade-in">
      <PageHeader title="تنظیمات مدرسه" description="مدیریت سال‌های تحصیلی، پایه‌ها و دروس مدرسه" />
      <div className="mb-6">
        <SchoolLogoPanel />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AcademicYearsPanel />
        <GradesPanel />
        <ClassesPanel />
        <SubjectsPanel />
      </div>
    </div>
  );
}

// The school's own logo, shown in the sidebar once set (Sidebar.tsx
// reads it from useSchoolSettings). Backed by GET/PUT /settings —
// school_admin-only, same as everything else on this page.
function SchoolLogoPanel() {
  const settingsQuery = useSchoolSettings();
  const updateSettings = useUpdateSchoolSettings();
  const { showSuccess, showError } = useToast();

  const [logoUrl, setLogoUrl] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [previewOk, setPreviewOk] = useState(true);

  // Seed the input once the current setting loads, without clobbering
  // whatever the admin is mid-typing on a later refetch.
  useEffect(() => {
    if (settingsQuery.data) {
      setLogoUrl(settingsQuery.data.logoUrl ?? '');
    }
  }, [settingsQuery.data]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = logoUrl.trim();
    updateSettings.mutate(
      { logoUrl: trimmed === '' ? null : trimmed },
      {
        onSuccess: () => showSuccess('لوگوی مدرسه بروزرسانی شد'),
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <Card title="لوگوی مدرسه">
      <p className="mb-4 text-sm text-ink/60 dark:text-paper/60">
        آدرس اینترنتی تصویر لوگوی مدرسه را وارد کنید. این لوگو در نوار کناری، کنار نام مدرسه نمایش داده می‌شود.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Input
          value={logoUrl}
          onChange={(e) => {
            setLogoUrl(e.target.value);
            setPreviewOk(true);
          }}
          type="url"
          placeholder="https://example.com/logo.png"
          label="آدرس لوگو"
          containerClassName="flex-1"
        />
        <Button type="submit" loading={updateSettings.isPending} className="shrink-0">
          ذخیره
        </Button>
      </form>

      <FormError error={error} />

      {logoUrl.trim() !== '' && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-paper/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          {previewOk ? (
            <img
              src={logoUrl}
              alt="پیش‌نمایش لوگو"
              className="h-12 w-12 rounded-md border border-line bg-white object-contain p-1 dark:border-white/10"
              onError={() => setPreviewOk(false)}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-overdue/25 bg-overdue/10 text-[10px] text-overdue">
              خطا
            </div>
          )}
          <span className="text-xs text-ink/50 dark:text-paper/50">
            {previewOk ? 'پیش‌نمایش' : 'بارگذاری تصویر از این آدرس ممکن نشد.'}
          </span>
        </div>
      )}
    </Card>
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
          <PersianDatePicker value={startDate} onChange={setStartDate} label="تاریخ شروع" />
          <PersianDatePicker value={endDate} onChange={setEndDate} label="تاریخ پایان" />
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
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();
  const grades = gradesQuery.data ?? [];
  const { showError, showSuccess } = useToast();

  const [title, setTitle] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingGrade, setDeletingGrade] = useState<Grade | null>(null);

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

  function startEdit(g: Grade) {
    setEditingId(g.id);
    setEditingTitle(g.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle('');
  }

  function saveEdit(id: string) {
    updateGrade.mutate(
      { id, dto: { title: editingTitle } },
      {
        onSuccess: () => {
          cancelEdit();
          showSuccess('پایه بروزرسانی شد');
        },
        onError: (err) => showError(getErrorMessage(err)),
      },
    );
  }

  function confirmDelete() {
    if (!deletingGrade) return;
    deleteGrade.mutate(deletingGrade.id, {
      onSuccess: () => {
        setDeletingGrade(null);
        showSuccess('پایه حذف شد');
      },
      onError: (err) => {
        showError(getErrorMessage(err));
        setDeletingGrade(null);
      },
    });
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
      render: (g) =>
        editingId === g.id ? (
          <Input
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            containerClassName="mb-0"
          />
        ) : (
          <span className="font-medium text-ink dark:text-paper">{g.title}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (g) =>
        editingId === g.id ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit}>
              انصراف
            </Button>
            <Button size="sm" loading={updateGrade.isPending} onClick={() => saveEdit(g.id)}>
              ذخیره
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => startEdit(g)}>
              ویرایش
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeletingGrade(g)}>
              حذف
            </Button>
          </div>
        ),
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

      <Modal
        open={!!deletingGrade}
        onClose={() => setDeletingGrade(null)}
        title="حذف پایه تحصیلی"
        description={
          deletingGrade ? `آیا از حذف «${deletingGrade.title}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingGrade(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={deleteGrade.isPending} onClick={confirmDelete}>
              حذف
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </Card>
  );
}

// Class/section management -- added to fix the bug where a grade with
// two sections (two teachers, two physical classes) had every student
// lumped together everywhere, because the schema had no concept finer
// than Grade. Unlike GradesPanel above, a class is scoped to
// (grade, academicYear) -- both must be picked before the list/create
// form means anything, so this panel has its own two selectors on top of
// the same "add row / inline edit / confirm delete" shape GradesPanel
// already uses.
function ClassesPanel() {
  const gradesQuery = useGrades();
  const academicYearsQuery = useAcademicYears();
  const grades = gradesQuery.data ?? [];
  const academicYears = academicYearsQuery.data ?? [];
  const { showError, showSuccess } = useToast();

  const [gradeId, setGradeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState(() => academicYears.find((y) => y.isCurrent)?.id ?? '');

  useEffect(() => {
    if (!academicYearId) {
      const current = academicYears.find((y) => y.isCurrent);
      if (current) setAcademicYearId(current.id);
    }
  }, [academicYears]); // eslint-disable-line react-hooks/exhaustive-deps

  const classesQuery = useClasses(gradeId && academicYearId ? { gradeId, academicYearId } : undefined);
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const classes = classesQuery.data ?? [];

  const [title, setTitle] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createClass.mutate(
      { gradeId, academicYearId, title },
      {
        onSuccess: () => {
          setTitle('');
          showSuccess('کلاس ثبت شد');
        },
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  function startEdit(c: SchoolClass) {
    setEditingId(c.id);
    setEditingTitle(c.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle('');
  }

  function saveEdit(id: string) {
    updateClass.mutate(
      { id, dto: { title: editingTitle } },
      {
        onSuccess: () => {
          cancelEdit();
          showSuccess('کلاس بروزرسانی شد');
        },
        onError: (err) => showError(getErrorMessage(err)),
      },
    );
  }

  function confirmDelete() {
    if (!deletingClass) return;
    deleteClass.mutate(deletingClass.id, {
      onSuccess: () => {
        setDeletingClass(null);
        showSuccess('کلاس حذف شد');
      },
      onError: (err) => {
        showError(getErrorMessage(err));
        setDeletingClass(null);
      },
    });
  }

  const columns: TableColumn<SchoolClass>[] = [
    {
      key: 'index',
      header: '#',
      cellClassName: 'text-ink/45 dark:text-paper/45',
      render: (c) => toPersianDigits(classes.findIndex((x) => x.id === c.id) + 1),
    },
    {
      key: 'title',
      header: 'عنوان کلاس',
      render: (c) =>
        editingId === c.id ? (
          <Input
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            containerClassName="mb-0"
          />
        ) : (
          <span className="font-medium text-ink dark:text-paper">{c.title}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (c) =>
        editingId === c.id ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit}>
              انصراف
            </Button>
            <Button size="sm" loading={updateClass.isPending} onClick={() => saveEdit(c.id)}>
              ذخیره
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
              ویرایش
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeletingClass(c)}>
              حذف
            </Button>
          </div>
        ),
    },
  ];

  return (
    <Card title="کلاس‌ها (شعب هر پایه)">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">پایه تحصیلی</label>
          <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">سال تحصیلی</label>
          <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title} {y.isCurrent ? '(جاری)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!gradeId || !academicYearId ? (
        <p className="rounded-lg bg-paper/60 p-4 text-sm text-ink/60 dark:bg-white/[0.03] dark:text-paper/60">
          برای مدیریت کلاس‌ها، ابتدا پایه تحصیلی و سال تحصیلی را انتخاب کنید.
        </p>
      ) : (
        <>
          <SectionHeader title="افزودن کلاس جدید" className="mb-4" />
          <form
            onSubmit={handleSubmit}
            className="mb-6 flex flex-col gap-3 rounded-lg bg-paper/60 p-4 dark:bg-white/[0.03] sm:flex-row sm:items-end"
          >
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان کلاس — مثلاً الف"
              label="عنوان کلاس"
              containerClassName="flex-1"
            />
            <Button type="submit" loading={createClass.isPending} className="shrink-0">
              افزودن
            </Button>
          </form>

          <FormError error={error} />

          <SectionHeader title="فهرست کلاس‌های این پایه" className="mb-3" />
          <Table
            columns={columns}
            data={classes}
            rowKey={(c) => c.id}
            loading={classesQuery.isLoading}
            emptyMessage="هنوز کلاسی برای این پایه و سال تحصیلی ثبت نشده است."
          />
        </>
      )}

      <Modal
        open={!!deletingClass}
        onClose={() => setDeletingClass(null)}
        title="حذف کلاس"
        description={
          deletingClass ? `آیا از حذف «${deletingClass.title}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingClass(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={deleteClass.isPending} onClick={confirmDelete}>
              حذف
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </Card>
  );
}

// Sprint 2B follow-up: SubjectsController/createSubject already existed
// on the backend (added for TeacherAssignmentsPage's subject picker) but
// had no admin UI anywhere to actually create one — same "افزودن پایه
// جدید" pattern as GradesPanel above, since Subject has the exact same
// { id, title } shape and role gate (school_admin manages the list) as
// Grade.
function SubjectsPanel() {
  const subjectsQuery = useSubjects();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();
  const subjects = subjectsQuery.data ?? [];
  const { showError, showSuccess } = useToast();

  const [title, setTitle] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createSubject.mutate(
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

  function startEdit(s: Subject) {
    setEditingId(s.id);
    setEditingTitle(s.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle('');
  }

  function saveEdit(id: string) {
    updateSubject.mutate(
      { id, dto: { title: editingTitle } },
      {
        onSuccess: () => {
          cancelEdit();
          showSuccess('درس بروزرسانی شد');
        },
        onError: (err) => showError(getErrorMessage(err)),
      },
    );
  }

  function confirmDelete() {
    if (!deletingSubject) return;
    deleteSubject.mutate(deletingSubject.id, {
      onSuccess: () => {
        setDeletingSubject(null);
        showSuccess('درس حذف شد');
      },
      onError: (err) => {
        showError(getErrorMessage(err));
        setDeletingSubject(null);
      },
    });
  }

  const columns: TableColumn<Subject>[] = [
    {
      key: 'index',
      header: '#',
      cellClassName: 'text-ink/45 dark:text-paper/45',
      render: (s) => toPersianDigits(subjects.findIndex((x) => x.id === s.id) + 1),
    },
    {
      key: 'title',
      header: 'عنوان درس',
      render: (s) =>
        editingId === s.id ? (
          <Input
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            containerClassName="mb-0"
          />
        ) : (
          <span className="font-medium text-ink dark:text-paper">{s.title}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (s) =>
        editingId === s.id ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit}>
              انصراف
            </Button>
            <Button size="sm" loading={updateSubject.isPending} onClick={() => saveEdit(s.id)}>
              ذخیره
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
              ویرایش
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeletingSubject(s)}>
              حذف
            </Button>
          </div>
        ),
    },
  ];

  return (
    <Card title="دروس">
      <SectionHeader title="افزودن درس جدید" className="mb-4" />
      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-3 rounded-lg bg-paper/60 p-4 dark:bg-white/[0.03] sm:flex-row sm:items-end"
      >
        <Input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان درس — مثلاً ریاضی"
          label="عنوان درس"
          containerClassName="flex-1"
        />
        <Button type="submit" loading={createSubject.isPending} className="shrink-0">
          افزودن
        </Button>
      </form>

      <FormError error={error} />

      <SectionHeader title="فهرست دروس" className="mb-3" />
      <Table
        columns={columns}
        data={subjects}
        rowKey={(s) => s.id}
        loading={subjectsQuery.isLoading}
        emptyMessage="هنوز درسی ثبت نشده است."
      />

      <Modal
        open={!!deletingSubject}
        onClose={() => setDeletingSubject(null)}
        title="حذف درس"
        description={
          deletingSubject ? `آیا از حذف «${deletingSubject.title}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingSubject(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={deleteSubject.isPending} onClick={confirmDelete}>
              حذف
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </Card>
  );
}
