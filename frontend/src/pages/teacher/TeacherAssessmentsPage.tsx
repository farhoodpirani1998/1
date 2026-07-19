// Teacher Assessments.
//
// Backend is frozen for this feature: POST /teacher/assessments,
// GET /teacher/classes, GET /teacher/subjects, GET /teacher/students
// already exist on TeacherController (see
// backend/src/modules/teacher/teacher.controller.ts and the
// student-assessments module it delegates to). There is no bulk
// assessment endpoint, so Save submits one POST per modified student —
// safe to retry since AssessmentsService.record() upserts on
// (studentId, subjectId, academicYearId, term) rather than erroring on a
// resubmit.
//
// Redesign (this pass): the page was a bare filter row + table. Kept
// every existing piece of real logic (gradeId/subjectId/term selection,
// per-row dirty/saved/error tracking, parseScore, Promise.allSettled
// batch submit) untouched and added a real toolbar around it:
//   - a selection column (checkbox per row, reusing Table's
//     `selectedRowKeys` the same way StudentsPage's Sprint 3.3 bulk bar
//     does) so "بulk اعمال به انتخاب‌شده‌ها" has something to act on
//   - بulk value entry: apply one score to the selected rows, or to
//     every still-empty row in one click ("تکمیل خودکار خالی‌ها")
//   - spreadsheet-style paste: pasting a copied Excel column into any
//     score cell fills that cell and every row below it, matching how
//     people already expect paste-into-a-grid to behave
//   - Import/Export Excel (reuses lib/exportExcel + the xlsx package
//     already used by BulkImportStudentsPanel — no new dependency)
//   - Undo/Redo over the *bulk* operations (fill/paste/import/clear) —
//     deliberately NOT per-keystroke, which would be noisy and useless;
//     see commitRows() below
//   - a local-only draft ("ثبت موقت"): saved to localStorage per
//     (grade, subject, term), so a half-finished sheet survives an
//     accidental refresh. This is separate from the real "ذخیره نمرات"
//     submit and never touches the network by itself.
//   - a stats/progress strip (میانگین/بیشترین/کمترین/تعداد ثبت‌شده/
//     باقیمانده + a progress bar) computed from the scores currently in
//     the editor, not just what's been saved to the server yet.
//
// Deliberately NOT added, because there's no backend support to back
// them honestly (a control that visibly does nothing is worse than no
// control):
//   - سال تحصیلی: the backend always resolves the *current* academic
//     year server-side for a teacher's submissions — there's no
//     endpoint today that lets a teacher submit against a past year.
//   - نوع آزمون / نوبت (exam type / sitting): CreateAssessmentDto only
//     has (studentId, subjectId, term, score, note) — no exam-type or
//     sitting-number field exists on the assessment entity.
//   - حضور (attendance) column: attendance is a separate resource
//     (POST /teacher/attendance, its own (studentId, date) upsert) —
//     folding it into this table would silently imply it's part of the
//     assessment record, which it isn't. See TeacherAttendancePage.
// All four are one-line additions once the backend grows the fields —
// this file's shape (RowState, columns, toolbar) doesn't need to change
// to add them later.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { FilterBar } from '../../components/FilterBar';
import { Select } from '../../components/Select';
import { Input } from '../../components/Input';
import { Table, type TableColumn } from '../../components/Table';
import { Button } from '../../components/Button';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { StudentProfileModal } from '../../components/StudentProfileModal';
import { useToast } from '../../lib/toast';
import { getErrorMessage } from '../../lib/error-handler';
import { exportToExcel } from '../../lib/exportExcel';
import {
  useTeacherClasses,
  useTeacherSubjects,
  useTeacherStudents,
  useRecordAssessment,
} from '../../hooks/useTeacher';
import type { AssessmentTermValue } from '../../api/teacher.api';
import type { Student } from '../../types/student.types';

const TERM_OPTIONS: { value: AssessmentTermValue; label: string }[] = [
  { value: 'first_term', label: 'ترم اول' },
  { value: 'second_term', label: 'ترم دوم' },
];

// Local per-student editor state. `savedFor` records the (score, note)
// pair that was last successfully persisted, so a row only gets
// re-submitted when something has actually changed since its last
// successful save — not on every click of Save. Score is kept as the
// raw string the user typed (not a number) so an empty field reliably
// means "not marked" rather than colliding with the valid score 0.
interface RowState {
  score: string;
  note: string;
  savedFor: { score: string; note: string } | null;
  error: string | null;
}

const EMPTY_ROW: RowState = { score: '', note: '', savedFor: null, error: null };

function isDirty(row: RowState): boolean {
  if (row.score.trim() === '') return false;
  if (!row.savedFor) return true;
  return row.savedFor.score !== row.score || row.savedFor.note !== row.note;
}

// score must be a non-negative number — CreateAssessmentDto's own
// @IsNumber()/@Min(0) — checked client-side so an obviously invalid
// value never becomes a wasted round trip / noisy 400.
function parseScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

function toPersianCount(n: number): string {
  return n.toLocaleString('fa-IR');
}

// Local-draft persistence — deliberately localStorage, not the backend.
// Keyed by the three filters that define an editing "session" so
// switching grade/subject/term never bleeds one draft into another.
function draftKey(gradeId: string, subjectId: string, term: string) {
  return `teacher-assessment-draft:${gradeId}:${subjectId}:${term}`;
}

function loadDraft(gradeId: string, subjectId: string, term: string): Record<string, RowState> | null {
  try {
    const raw = localStorage.getItem(draftKey(gradeId, subjectId, term));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, RowState>;
  } catch {
    return null;
  }
}

function saveDraft(gradeId: string, subjectId: string, term: string, rows: Record<string, RowState>) {
  try {
    localStorage.setItem(draftKey(gradeId, subjectId, term), JSON.stringify(rows));
  } catch {
    // best-effort only — a full localStorage or private-browsing mode
    // should never block the real editor from working
  }
}

function clearDraft(gradeId: string, subjectId: string, term: string) {
  try {
    localStorage.removeItem(draftKey(gradeId, subjectId, term));
  } catch {
    // no-op
  }
}

export function TeacherAssessmentsPage() {
  const { showSuccess, showError } = useToast();
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState<AssessmentTermValue | ''>('');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState('');
  // پروفایل دانش‌آموز — opened by clicking a student's name in the table
  // below; renders via the shared <StudentProfileModal/> so it matches
  // every other student-profile entry point in the app.
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/redo over bulk operations only (fill-selected, fill-empty,
  // paste, import, clear) — see file header for why per-keystroke
  // history was left out. `past`/`future` hold full row snapshots.
  const [past, setPast] = useState<Record<string, RowState>[]>([]);
  const [future, setFuture] = useState<Record<string, RowState>[]>([]);

  const classesQuery = useTeacherClasses();
  const subjectsQuery = useTeacherSubjects();
  const studentsQuery = useTeacherStudents(gradeId || undefined);
  const recordAssessment = useRecordAssessment();

  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const ready = !!gradeId && !!subjectId && !!term;

  // A new grade/subject/term is a new assessment session — start each
  // one with a clean editor rather than carrying over scores that no
  // longer refer to the same subject+term. If a local draft exists for
  // this exact combination, load it instead of starting blank.
  useEffect(() => {
    setSelectedIds(new Set());
    setPast([]);
    setFuture([]);
    if (gradeId && subjectId && term) {
      const draft = loadDraft(gradeId, subjectId, term);
      if (draft) {
        setRows(draft);
        showSuccess('پیش‌نویس محلی این کلاس/درس/ترم بارگذاری شد');
        return;
      }
    }
    setRows({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, subjectId, term]);

  function rowFor(studentId: string): RowState {
    return rows[studentId] ?? EMPTY_ROW;
  }

  // Every direct edit (typing) just sets state — not tracked in
  // undo/redo history, intentionally (see file header).
  function setScore(studentId: string, score: string) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...rowFor(studentId), score, error: null },
    }));
  }

  function setNote(studentId: string, note: string) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...rowFor(studentId), note, error: null },
    }));
  }

  // Bulk/paste/import/clear operations go through here so they're
  // undoable as a single step.
  function commitRows(next: Record<string, RowState>) {
    setPast((p) => [...p, rows].slice(-30));
    setFuture([]);
    setRows(next);
  }

  function handleUndo() {
    if (past.length === 0) return;
    setFuture((f) => [rows, ...f]);
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setRows(prev);
  }

  function handleRedo() {
    if (future.length === 0) return;
    setPast((p) => [...p, rows]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    setRows(next);
  }

  // Selection column — same Set<string>-of-ids pattern as StudentsPage's
  // Sprint 3.3 row selection, scoped to the currently loaded roster.
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id)) && !allSelected;

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(students.map((s) => s.id));
    });
  }

  // "ثبت دسته‌ای" — apply one score to every currently-selected row.
  function applyBulkToSelected() {
    const score = parseScore(bulkValue);
    if (score === null) {
      showError('مقدار وارد شده برای ثبت دسته‌ای معتبر نیست');
      return;
    }
    if (selectedIds.size === 0) {
      showError('ابتدا حداقل یک دانش‌آموز را انتخاب کنید');
      return;
    }
    const next = { ...rows };
    selectedIds.forEach((id) => {
      next[id] = { ...rowFor(id), score: bulkValue.trim(), error: null };
    });
    commitRows(next);
    showSuccess(`نمره ${toPersianCount(selectedIds.size)} دانش‌آموز انتخاب‌شده تنظیم شد (هنوز ذخیره نشده)`);
  }

  // "ثبت خودکار" — fill only the rows nobody has typed a score into yet.
  // Never overwrites a row that already has a value, so it's safe to hit
  // repeatedly as new empty rows appear (e.g. after adding a student).
  function applyBulkToEmpty() {
    const score = parseScore(bulkValue);
    if (score === null) {
      showError('مقدار وارد شده برای ثبت خودکار معتبر نیست');
      return;
    }
    const next = { ...rows };
    let count = 0;
    students.forEach((s) => {
      if (rowFor(s.id).score.trim() === '') {
        next[s.id] = { ...rowFor(s.id), score: bulkValue.trim(), error: null };
        count += 1;
      }
    });
    if (count === 0) {
      showError('همه ردیف‌ها از قبل مقدار دارند');
      return;
    }
    commitRows(next);
    showSuccess(`${toPersianCount(count)} ردیف خالی با مقدار ${bulkValue} تکمیل شد (هنوز ذخیره نشده)`);
  }

  // Spreadsheet-style paste: pasting a copied Excel column (or a
  // name<TAB>score two-column copy) into any score cell fills that cell
  // and continues down the visible roster from that row.
  function handleScorePaste(startStudentId: string, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.includes('\n') && !text.includes('\t')) return; // single value: let default paste happen
    e.preventDefault();

    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
    const startIndex = students.findIndex((s) => s.id === startStudentId);
    if (startIndex === -1) return;

    const next = { ...rows };
    let applied = 0;
    lines.forEach((line, i) => {
      const target = students[startIndex + i];
      if (!target) return;
      const cells = line.split('\t');
      // Two+ columns: last cell is the score, everything pastes as-is
      // otherwise (single column = just the score per row, in order).
      const scoreCell = cells.length > 1 ? cells[cells.length - 1] : cells[0];
      next[target.id] = { ...rowFor(target.id), score: scoreCell.trim(), error: null };
      applied += 1;
    });
    commitRows(next);
    showSuccess(`${toPersianCount(applied)} ردیف از کلیپ‌بورد Paste شد (هنوز ذخیره نشده)`);
  }

  // Import Excel — matches by کد ملی if present, otherwise by exact نام.
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        const byNationalId = new Map(students.filter((s) => s.nationalId).map((s) => [s.nationalId, s]));
        const byName = new Map(students.map((s) => [s.fullName.trim(), s]));

        const next = { ...rows };
        let matched = 0;
        let unmatched = 0;
        raw.forEach((r) => {
          const code = String(r['کد ملی'] ?? '').trim();
          const name = String(r['نام'] ?? r['نام دانش‌آموز'] ?? '').trim();
          const scoreRaw = String(r['نمره'] ?? '').trim();
          const noteRaw = String(r['یادداشت'] ?? '').trim();
          const student = (code && byNationalId.get(code)) || byName.get(name);
          if (!student || scoreRaw === '') {
            unmatched += 1;
            return;
          }
          next[student.id] = { ...rowFor(student.id), score: scoreRaw, note: noteRaw, error: null };
          matched += 1;
        });

        if (matched === 0) {
          showError('هیچ ردیفی با دانش‌آموزان این کلاس مطابقت نداشت');
          return;
        }
        commitRows(next);
        if (unmatched === 0) {
          showSuccess(`${toPersianCount(matched)} نمره از فایل اکسل بارگذاری شد (هنوز ذخیره نشده)`);
        } else {
          showError(`${toPersianCount(matched)} مورد بارگذاری شد — ${toPersianCount(unmatched)} ردیف مطابقت نیافت`);
        }
      } catch {
        showError('فایل قابل خواندن نیست — فرمت xlsx یا csv باشد.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleExport() {
    exportToExcel(
      'ارزیابی',
      'ارزیابی',
      students.map((s) => {
        const row = rowFor(s.id);
        return {
          نام: s.fullName,
          'کد ملی': s.nationalId ?? '',
          نمره: row.score,
          یادداشت: row.note,
          وضعیت: row.score.trim() === '' ? 'ثبت نشده' : row.savedFor?.score === row.score ? 'ذخیره شده' : 'ذخیره‌نشده',
        };
      }),
    );
  }

  function handleSaveDraft() {
    if (!ready) return;
    saveDraft(gradeId, subjectId, term, rows);
    showSuccess('پیش‌نویس به‌صورت محلی ذخیره شد (فقط روی همین مرورگر)');
  }

  const dirtyEntries = Object.entries(rows).filter(([, row]) => isDirty(row));
  const canSave = ready && dirtyEntries.length > 0 && !saving;

  async function handleSaveAll() {
    if (!ready || dirtyEntries.length === 0) return;

    // Split out anything that fails the client-side score check before
    // touching the network at all — those rows are marked with an error
    // and excluded from this batch's submissions.
    const valid: [string, RowState, number][] = [];
    const invalidIds: string[] = [];
    dirtyEntries.forEach(([studentId, row]) => {
      const score = parseScore(row.score);
      if (score === null) {
        invalidIds.push(studentId);
      } else {
        valid.push([studentId, row, score]);
      }
    });

    if (invalidIds.length > 0) {
      setRows((prev) => {
        const next = { ...prev };
        invalidIds.forEach((id) => {
          next[id] = { ...next[id], error: 'نمره نامعتبر است' };
        });
        return next;
      });
    }

    if (valid.length === 0) {
      showError('هیچ نمره معتبری برای ثبت وجود ندارد');
      return;
    }

    setSaving(true);

    const results = await Promise.allSettled(
      valid.map(([studentId, row, score]) =>
        recordAssessment.mutateAsync({
          studentId,
          subjectId,
          term: term as AssessmentTermValue,
          score,
          note: row.note.trim() || undefined,
        }),
      ),
    );

    let allNext: Record<string, RowState> = {};
    setRows((prev) => {
      const next = { ...prev };
      results.forEach((result, i) => {
        const [studentId, row] = valid[i];
        if (result.status === 'fulfilled') {
          next[studentId] = {
            ...row,
            savedFor: { score: row.score, note: row.note },
            error: null,
          };
        } else {
          next[studentId] = { ...row, error: getErrorMessage(result.reason) };
        }
      });
      allNext = next;
      return next;
    });

    setSaving(false);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount === 0 && invalidIds.length === 0) {
      showSuccess(`نمره ${successCount} دانش‌آموز با موفقیت ثبت شد`);
      // Everything that was dirty is now saved — the local draft (if
      // any) no longer represents unsaved work, so drop it.
      clearDraft(gradeId, subjectId, term);
    } else if (successCount === 0) {
      showError(`ثبت نمرات انجام نشد (${failCount + invalidIds.length} مورد با خطا مواجه شد)`);
    } else {
      showError(
        `${successCount} مورد ثبت شد — ${failCount + invalidIds.length} مورد با خطا مواجه شد و نیاز به تلاش مجدد دارد`,
      );
      // Partial success: keep whatever still needs attention as the draft.
      saveDraft(gradeId, subjectId, term, allNext);
    }
  }

  // Stats strip — computed from what's currently in the editor (typed,
  // pasted, imported, or already saved), not only from confirmed saves,
  // so a teacher mid-entry can see where the class stands right now.
  const stats = useMemo(() => {
    const scores = students
      .map((s) => parseScore(rowFor(s.id).score))
      .filter((n): n is number => n !== null);
    const filled = scores.length;
    const total = students.length;
    return {
      average: filled > 0 ? scores.reduce((a, b) => a + b, 0) / filled : null,
      max: filled > 0 ? Math.max(...scores) : null,
      min: filled > 0 ? Math.min(...scores) : null,
      filled,
      remaining: Math.max(0, total - filled),
      total,
      pct: total > 0 ? Math.round((filled / total) * 100) : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, rows]);

  const columns: TableColumn<Student>[] = [
    {
      key: 'select',
      header: (
        <SelectionCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleSelectAll}
          ariaLabel="انتخاب همه دانش‌آموزان"
        />
      ),
      align: 'center',
      headerClassName: 'w-10',
      cellClassName: 'w-10',
      render: (s) => (
        <SelectionCheckbox
          checked={selectedIds.has(s.id)}
          onChange={() => toggleSelectRow(s.id)}
          ariaLabel={`انتخاب ${s.fullName}`}
        />
      ),
    },
    {
      key: 'fullName',
      header: 'نام دانش‌آموز',
      render: (s) => (
        <div>
          <button
            type="button"
            onClick={() => setProfileStudentId(s.id)}
            className="font-medium text-ink underline-offset-2 hover:text-action hover:underline dark:text-paper"
          >
            {s.fullName}
          </button>
          {rowFor(s.id).error && <div className="mt-0.5 text-xs text-overdue">{rowFor(s.id).error}</div>}
        </div>
      ),
    },
    {
      key: 'code',
      header: 'کد',
      cellClassName: 'text-ink/60 dark:text-paper/60',
      render: (s) => s.nationalId || '—',
    },
    {
      key: 'score',
      header: 'نمره (از ۲۰)',
      render: (s) => {
        const row = rowFor(s.id);
        return (
          <Input
            type="number"
            min={0}
            step={0.25}
            value={row.score}
            onChange={(e) => setScore(s.id, e.target.value)}
            onPaste={(e) => handleScorePaste(s.id, e)}
            placeholder="ثبت نشده"
            containerClassName="min-w-[110px]"
          />
        );
      },
    },
    {
      key: 'badge',
      header: 'وضعیت',
      render: (s) => {
        const row = rowFor(s.id);
        if (row.score.trim() === '') return null;
        const saved = row.savedFor?.score === row.score && row.savedFor?.note === row.note;
        return (
          <span
            className={`badge ${
              saved
                ? 'bg-paid/10 text-paid border-paid/25'
                : 'bg-ink/5 text-ink/60 border-line dark:bg-white/5 dark:text-paper/60 dark:border-white/10'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {saved ? 'ذخیره شد' : 'ذخیره‌نشده'}
          </span>
        );
      },
    },
    {
      key: 'note',
      header: 'توضیح (اختیاری)',
      render: (s) => {
        const row = rowFor(s.id);
        return (
          <Input
            value={row.note}
            onChange={(e) => setNote(s.id, e.target.value)}
            placeholder="یادداشت..."
            containerClassName="min-w-[160px]"
          />
        );
      },
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="ارزیابی‌ها"
        description="ثبت نمرات دانش‌آموزان کلاس‌های تخصیص‌یافته به شما"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={handleUndo} disabled={past.length === 0} title="واگرد">
              <UndoIcon />
              واگرد
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRedo} disabled={future.length === 0} title="ازنو">
              <RedoIcon />
              ازنو
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={!ready}>
              <DraftIcon />
              ثبت موقت
            </Button>
            <Button variant="primary" onClick={handleSaveAll} disabled={!canSave} loading={saving}>
              ذخیره نمرات
            </Button>
          </>
        }
      />

      <FilterBar>
        <Select
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          placeholder="انتخاب کلاس"
          options={classes.map((c) => ({ value: c.id, label: c.title }))}
          containerClassName="min-w-[180px]"
        />
        <Select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="انتخاب درس"
          options={subjects.map((subj) => ({ value: subj.id, label: subj.title }))}
          containerClassName="min-w-[180px]"
        />
        <Select
          value={term}
          onChange={(e) => setTerm(e.target.value as AssessmentTermValue | '')}
          placeholder="انتخاب ترم/نوبت"
          options={TERM_OPTIONS}
          containerClassName="min-w-[150px]"
        />
      </FilterBar>

      {ready && (
        <FilterBar
          className="mb-4"
          actions={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                className="hidden"
                id="assessment-import-input"
              />
              <label htmlFor="assessment-import-input" className="btn-secondary cursor-pointer text-xs">
                <ImportIcon />
                Import Excel
              </label>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <ExportIcon />
                Export Excel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => showSuccess('روی خانهٔ نمرهٔ ردیف اول کلیک کنید و ستون کپی‌شده از اکسل را Paste کنید (Ctrl+V)')}
              >
                <PasteIcon />
                Paste از Excel
              </Button>
            </>
          }
        >
          <Input
            type="number"
            min={0}
            step={0.25}
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="مقدار برای ثبت دسته‌ای"
            containerClassName="min-w-[170px]"
          />
          <Button variant="secondary" size="sm" onClick={applyBulkToSelected} disabled={selectedIds.size === 0}>
            ثبت دسته‌ای ({toPersianCount(selectedIds.size)} انتخاب‌شده)
          </Button>
          <Button variant="secondary" size="sm" onClick={applyBulkToEmpty}>
            ثبت خودکار (تکمیل خالی‌ها)
          </Button>
        </FilterBar>
      )}

      {ready && stats.total > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="میانگین کلاس" value={stats.average !== null ? stats.average.toFixed(2) : '—'} accent="action" />
          <StatCard label="بیشترین نمره" value={stats.max !== null ? String(stats.max) : '—'} accent="paid" />
          <StatCard label="کمترین نمره" value={stats.min !== null ? String(stats.min) : '—'} accent="warning" />
          <StatCard label="تعداد ثبت‌شده" value={toPersianCount(stats.filled)} />
          <StatCard label="باقی‌مانده" value={toPersianCount(stats.remaining)} accent={stats.remaining > 0 ? 'overdue' : 'paid'} />
        </div>
      )}

      {ready && stats.total > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-ink/55 dark:text-paper/55">
            <span>
              {toPersianCount(stats.filled)} از {toPersianCount(stats.total)} دانش‌آموز ثبت شده
            </span>
            <span>{toPersianCount(stats.pct)}٪</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-action transition-all" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>
      )}

      <Card>
        {!ready ? (
          <EmptyState
            message="ابتدا کلاس، درس و ترم را انتخاب کنید"
            description="برای مشاهده دانش‌آموزان و ثبت نمره، هر سه فیلتر بالا را تکمیل نمایید."
          />
        ) : studentsQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری دانش‌آموزان"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => studentsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={students}
            rowKey={(s) => s.id}
            selectedRowKeys={selectedIds}
            loading={studentsQuery.isLoading}
            skeletonRows={5}
            emptyMessage="دانش‌آموزی یافت نشد."
            emptyDescription="در این کلاس دانش‌آموزی ثبت نشده است."
          />
        )}
      </Card>

      <StudentProfileModal
        studentId={profileStudentId ?? undefined}
        open={profileStudentId !== null}
        onClose={() => setProfileStudentId(null)}
        role="teacher"
      />
    </div>
  );
}

// Selection checkbox — same imperative-indeterminate pattern as
// StudentsPage's SelectionCheckbox (Sprint 3.3), duplicated locally per
// that same file's own convention rather than promoted to a shared
// component (it's a two-line wrapper, not worth a new shared import).
function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer rounded border-line text-action accent-action focus:outline-none focus:ring-2 focus:ring-action/30 dark:border-white/25"
    />
  );
}

// Small page-local icons — same 15x15 / viewBox 0 0 24 24 / currentColor
// stroke convention as StudentsPage's toolbar icons.
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 8H4V4" />
      <path d="M4 8c2.5-3 6-4.5 9.5-3.8A8 8 0 1 1 6 18" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M16 8h4V4" />
      <path d="M20 8c-2.5-3-6-4.5-9.5-3.8A8 8 0 1 0 18 18" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 4.5h11l3 3V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M8 4.5V9h7V4.5" />
      <path d="M8 13.5h8" />
      <path d="M8 16.5h5" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="6" y="5" width="12" height="16" rx="1.5" />
      <path d="M9 5V3.8c0-.5.4-.8.8-.8h4.4c.4 0 .8.3.8.8V5" />
      <path d="M9 12h6M9 15.5h6" />
    </svg>
  );
}

// TODO (out of scope for this feature):
//   - Assessment history: a read view of previously recorded scores (no
//     GET route for a single student/subject/term is wired into the
//     frontend yet; the backend module owns a report-card builder but
//     TeacherController doesn't expose a GET /teacher/assessments route).
//   - Editing a past term's assessment from a history view (today's page
//     only ever resubmits for the currently selected subject+term).
//   - سال تحصیلی / نوع آزمون / نوبت / حضور — see the file header block;
//     each needs a real backend field before a control for it belongs here.
//   - Teacher Homework page is implemented separately — see
//     pages/teacher/TeacherHomeworkPage.tsx.
