import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card } from './Card';
import { Button } from './Button';
import { exportToExcel } from '../lib/exportExcel';
import { useBulkImportStudents } from '../hooks/useStudents';
import { useToast } from '../lib/toast';
import { getErrorMessage } from '../lib/error-handler';
import type { Grade, AcademicYear } from '../types/student.types';
import type { CreateStudentInput } from '../api/students.api';

// One parsed spreadsheet row, before/after client-side resolution.
interface ParsedRow {
  rowNumber: number; // 1-based, matches the spreadsheet's own row numbers (header = row 1)
  fullName: string;
  gradeTitle: string;
  academicYearTitle: string;
  nationalId: string;
  enrollmentDate: string;
  guardianName: string;
  guardianPhone: string;
  // Resolved once grades/academicYears are matched — undefined means
  // "could not resolve", which blocks this row from being sent.
  gradeId?: string;
  academicYearId?: string;
  localError?: string;
}

// Row status after a submit attempt: local validation failure (never
// sent), or the backend's own per-row outcome.
type RowStatus = { kind: 'pending' } | { kind: 'local-error'; message: string } | { kind: 'success' } | { kind: 'server-error'; message: string };

const REQUIRED_HEADERS = ['نام دانش‌آموز', 'پایه', 'نام والد', 'تلفن والد'];
const SAMPLE_ROW = {
  'نام دانش‌آموز': 'علی رضایی',
  پایه: 'پایه هفتم',
  'سال تحصیلی': '',
  'کد ملی': '',
  'تاریخ ثبت‌نام': '',
  'نام والد': 'محمد رضایی',
  'تلفن والد': '09120000000',
};

function excelCellToDateString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export function BulkImportStudentsPanel({
  grades,
  academicYears,
  onClose,
}: {
  grades: Grade[];
  academicYears: AcademicYear[];
  onClose: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const bulkImport = useBulkImportStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [statuses, setStatuses] = useState<Record<number, RowStatus>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleDownloadSample() {
    exportToExcel('نمونه-دانش‌آموزان', 'دانش‌آموزان', [SAMPLE_ROW]);
  }

  function resolveGradeId(title: string): string | undefined {
    const t = title.trim();
    return grades.find((g) => g.title.trim() === t)?.id;
  }

  function resolveAcademicYearId(title: string): string | undefined {
    const t = title.trim();
    if (!t) return academicYears.find((y) => y.isCurrent)?.id;
    return academicYears.find((y) => y.title.trim() === t)?.id;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setSubmitted(false);
    setStatuses({});

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        if (raw.length === 0) {
          setParseError('فایل خالی است یا ردیفی پیدا نشد.');
          setRows([]);
          return;
        }
        const headers = Object.keys(raw[0]);
        const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          setParseError(`ستون‌های زیر در فایل پیدا نشد: ${missing.join('، ')}`);
          setRows([]);
          return;
        }

        const parsed: ParsedRow[] = raw.map((r, i) => {
          const fullName = String(r['نام دانش‌آموز'] ?? '').trim();
          const gradeTitle = String(r['پایه'] ?? '').trim();
          const academicYearTitle = String(r['سال تحصیلی'] ?? '').trim();
          const nationalId = String(r['کد ملی'] ?? '').trim();
          const enrollmentDate = excelCellToDateString(r['تاریخ ثبت‌نام']);
          const guardianName = String(r['نام والد'] ?? '').trim();
          const guardianPhone = String(r['تلفن والد'] ?? '').trim();

          const gradeId = resolveGradeId(gradeTitle);
          const academicYearId = resolveAcademicYearId(academicYearTitle);

          let localError: string | undefined;
          if (!fullName) localError = 'نام دانش‌آموز خالی است';
          else if (!gradeTitle || !gradeId) localError = `پایه «${gradeTitle}» در سیستم یافت نشد`;
          else if (!academicYearId) localError = academicYearTitle ? `سال تحصیلی «${academicYearTitle}» یافت نشد` : 'سال تحصیلی جاری تعریف نشده است';
          else if (!guardianName || !guardianPhone) localError = 'نام یا تلفن والد خالی است';

          return {
            rowNumber: i + 2, // header is row 1 in the spreadsheet
            fullName,
            gradeTitle,
            academicYearTitle,
            nationalId,
            enrollmentDate,
            guardianName,
            guardianPhone,
            gradeId,
            academicYearId,
            localError,
          };
        });

        setRows(parsed);
        const initialStatuses: Record<number, RowStatus> = {};
        parsed.forEach((row) => {
          initialStatuses[row.rowNumber] = row.localError
            ? { kind: 'local-error', message: row.localError }
            : { kind: 'pending' };
        });
        setStatuses(initialStatuses);
      } catch {
        setParseError('فایل قابل خواندن نیست — فرمت xlsx یا csv باشد.');
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows = rows.filter((r) => !r.localError);
  const invalidCount = rows.length - validRows.length;

  function handleSubmit() {
    if (validRows.length === 0) return;
    const payload: CreateStudentInput[] = validRows.map((r) => ({
      academicYearId: r.academicYearId!,
      gradeId: r.gradeId!,
      fullName: r.fullName,
      nationalId: r.nationalId || undefined,
      enrollmentDate: r.enrollmentDate || undefined,
      newGuardian: { fullName: r.guardianName, phone: r.guardianPhone },
    }));

    bulkImport.mutate(payload, {
      onSuccess: (result) => {
        setSubmitted(true);
        const updated = { ...statuses };
        result.results.forEach((r) => {
          const row = validRows[r.index];
          if (!row) return;
          updated[row.rowNumber] = r.success
            ? { kind: 'success' }
            : { kind: 'server-error', message: r.error ?? 'خطای نامشخص' };
        });
        setStatuses(updated);
        if (result.failureCount === 0) {
          showSuccess(`همه ${result.successCount} دانش‌آموز با موفقیت ثبت شدند`);
        } else {
          showError(`${result.successCount} ثبت شد، ${result.failureCount} ردیف با خطا مواجه شد`);
        }
      },
      onError: (err) => {
        showError(getErrorMessage(err));
      },
    });
  }

  return (
    <Card title="آپلود اکسل دانش‌آموزان">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={handleDownloadSample}>
          دانلود نمونه فایل
        </Button>
        <label className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm hover:bg-paper dark:border-white/15">
          انتخاب فایل اکسل
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          بستن
        </Button>
      </div>

      <p className="mb-4 text-xs text-ink/50 dark:text-paper/50">
        ستون‌های الزامی: {REQUIRED_HEADERS.join('، ')}. ستون‌های «سال تحصیلی»، «کد ملی» و «تاریخ ثبت‌نام» اختیاری‌اند —
        اگر سال تحصیلی خالی باشد، سال تحصیلی جاری استفاده می‌شود. مقدار «پایه» و «سال تحصیلی» باید دقیقاً با نام
        ثبت‌شده در تنظیمات مدرسه یکسان باشد.
      </p>

      {parseError && (
        <div className="mb-4 rounded-lg border border-overdue/30 bg-overdue/10 px-3 py-2.5 text-sm text-overdue">
          {parseError}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm">
            <div className="text-ink/70 dark:text-paper/70">
              {rows.length} ردیف پیدا شد — {validRows.length} معتبر
              {invalidCount > 0 && <span className="text-overdue"> · {invalidCount} با خطا</span>}
            </div>
            {!submitted && (
              <Button type="button" onClick={handleSubmit} loading={bulkImport.isPending} disabled={validRows.length === 0}>
                ثبت {validRows.length} دانش‌آموز
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-navy-dark">
                <tr className="text-right text-ink/50">
                  <th className="py-1.5 font-medium">ردیف</th>
                  <th className="py-1.5 font-medium">نام</th>
                  <th className="py-1.5 font-medium">پایه</th>
                  <th className="py-1.5 font-medium">والد</th>
                  <th className="py-1.5 font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = statuses[row.rowNumber];
                  return (
                    <tr key={row.rowNumber} className="border-b border-line/50 last:border-0 dark:border-white/10">
                      <td className="tabular py-1.5 text-ink/50">{row.rowNumber}</td>
                      <td className="py-1.5">{row.fullName || '—'}</td>
                      <td className="py-1.5 text-ink/70 dark:text-paper/70">{row.gradeTitle || '—'}</td>
                      <td className="py-1.5 text-ink/70 dark:text-paper/70">{row.guardianName || '—'}</td>
                      <td className="py-1.5">
                        {status?.kind === 'pending' && <span className="text-ink/40">در انتظار ثبت</span>}
                        {status?.kind === 'local-error' && <span className="text-overdue">{status.message}</span>}
                        {status?.kind === 'server-error' && <span className="text-overdue">{status.message}</span>}
                        {status?.kind === 'success' && <span className="text-paid">ثبت شد</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
