import { useEffect, useMemo, useState, FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { SkeletonRows } from '../components/Skeleton';
import { Pagination, paginate } from '../components/Pagination';
import { useToast } from '../lib/toast';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from '../components/FormError';
import { exportToExcel } from '../lib/exportExcel';
import type { Student, Grade, AcademicYear } from '../types/student.types';
import { useStudents, useCreateStudent, useGrades, useAcademicYears } from '../hooks/useStudents';

const PAGE_SIZE = 10;

const statusLabels: Record<Student['status'], string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

export function StudentsPage() {
  const { showSuccess, showError } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  // Search is submit-triggered (not live-as-you-type) — matches the
  // original behavior exactly. This is the value actually sent to the
  // API / used in the query key; `search` above is just the input's
  // live text.
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createError, setCreateError] = useState<ParsedApiError | null>(null);

  const studentsQuery = useStudents(submittedSearch ? { search: submittedSearch } : undefined);
  const gradesQuery = useGrades();
  const academicYearsQuery = useAcademicYears();
  const createStudent = useCreateStudent();

  const students = studentsQuery.data ?? [];
  const grades = gradesQuery.data ?? [];
  const academicYears = academicYearsQuery.data ?? [];
  const loading = studentsQuery.isLoading;

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSubmittedSearch(search);
  }

  function handleExport() {
    exportToExcel(
      'دانش‌آموزان',
      'دانش‌آموزان',
      students.map((s) => ({
        نام: s.fullName,
        پایه: s.grade?.title ?? '',
        والد: s.guardian?.fullName ?? '',
        'تلفن والد': s.guardian?.phone ?? '',
        وضعیت: statusLabels[s.status],
      })),
    );
  }

  const pageCount = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const pageItems = useMemo(() => paginate(students, page, PAGE_SIZE), [students, page]);

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">دانش‌آموزان</h1>
        <div className="flex gap-2">
          <Link to="/students/archived" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper">
            غیرفعال‌ها
          </Link>
          <button onClick={handleExport} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper">
            خروجی Excel
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {showForm ? 'انصراف' : '+ دانش‌آموز جدید'}
          </button>
        </div>
      </div>

      {showForm && (
        <CreateStudentForm
          grades={grades}
          academicYears={academicYears}
          saving={createStudent.isPending}
          error={createError}
          onSubmit={(dto) => {
            setCreateError(null);
            createStudent.mutate(dto, {
              onSuccess: () => {
                setShowForm(false);
                showSuccess('دانش‌آموز ثبت شد');
              },
              onError: (err) => {
                setCreateError(parseApiError(err));
                showError(getErrorMessage(err));
              },
            });
          }}
        />
      )}

      <Card className="mt-4">
        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو با نام..."
            className="input flex-1"
          />
          <button type="submit" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper">
            جستجو
          </button>
        </form>

        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink/50">هنوز دانش‌آموزی ثبت نشده است.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-right text-ink/50">
                  <th className="py-2 font-medium">نام</th>
                  <th className="py-2 font-medium">پایه</th>
                  <th className="py-2 font-medium">والد</th>
                  <th className="py-2 font-medium">وضعیت</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="py-3 font-medium text-ink">{s.fullName}</td>
                    <td className="py-3 text-ink/70">{s.grade?.title ?? '—'}</td>
                    <td className="py-3 text-ink/70">{s.guardian?.fullName ?? '—'}</td>
                    <td className="py-3 text-ink/70">{statusLabels[s.status]}</td>
                    <td className="py-3 text-left">
                      <Link to={`/students/${s.id}`} className="text-action hover:underline">
                        صورت‌حساب
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

function CreateStudentForm({
  grades,
  academicYears,
  saving,
  error,
  onSubmit,
}: {
  grades: Grade[];
  academicYears: AcademicYear[];
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (dto: {
    academicYearId: string;
    gradeId: string;
    fullName: string;
    nationalId?: string;
    enrollmentDate?: string;
    newGuardian: { fullName: string; phone: string };
  }) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState(() => academicYears.find((y) => y.isCurrent)?.id ?? '');
  const [nationalId, setNationalId] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  useEffect(() => {
    if (!academicYearId) {
      const current = academicYears.find((y) => y.isCurrent);
      if (current) setAcademicYearId(current.id);
    }
  }, [academicYears]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Matches CreateStudentDto exactly: academicYearId + gradeId are
    // required; nationalId/enrollmentDate are optional; guardian is
    // either an existing guardianId OR a newGuardian object, never both.
    onSubmit({
      academicYearId,
      gradeId,
      fullName,
      nationalId: nationalId || undefined,
      enrollmentDate: enrollmentDate || undefined,
      newGuardian: { fullName: guardianName, phone: guardianPhone },
    });
  }

  return (
    <Card title="ثبت دانش‌آموز جدید">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی دانش‌آموز">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </Field>

        <Field label="پایه تحصیلی">
          <select required value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="سال تحصیلی">
          <select required value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="input">
            <option value="">انتخاب کنید</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title} {y.isCurrent ? '(جاری)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="کد ملی (اختیاری)">
          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="input tabular" />
        </Field>

        <Field label="تاریخ ثبت‌نام (اختیاری)">
          <input
            type="date"
            value={enrollmentDate}
            onChange={(e) => setEnrollmentDate(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="نام والد">
          <input required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="input" />
        </Field>

        <Field label="شماره تلفن والد">
          <input
            required
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            className="input"
            placeholder="۰۹۱۲xxxxxxx"
          />
        </Field>

        <div className="col-span-full">
          <FormError error={error} />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره دانش‌آموز'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
