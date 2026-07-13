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
// Mirrors TeacherAttendancePage's shape almost exactly (grade Select
// sourced from useTeacherClasses, Card + Table + EmptyState-on-error,
// per-row dirty/saved/error tracking, Promise.allSettled batch submit)
// with two differences: an added subject + term selector (both required
// by CreateAssessmentDto, unlike attendance's date which stands alone),
// and a numeric score input in place of a status Select.
//
// gradeId is intentionally never sent to the backend — it only narrows
// GET /teacher/students to build the roster, same as it does on
// TeacherAttendancePage. The assessment itself is scored per
// (student, subject, term), matching CreateAssessmentDto exactly.

import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { FilterBar } from '../../components/FilterBar';
import { Select } from '../../components/Select';
import { Input } from '../../components/Input';
import { Table, type TableColumn } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../lib/toast';
import { getErrorMessage } from '../../lib/error-handler';
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

export function TeacherAssessmentsPage() {
  const { showSuccess, showError } = useToast();
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState<AssessmentTermValue | ''>('');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

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
  // longer refer to the same subject+term.
  useEffect(() => {
    setRows({});
  }, [gradeId, subjectId, term]);

  function rowFor(studentId: string): RowState {
    return rows[studentId] ?? EMPTY_ROW;
  }

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
      return next;
    });

    setSaving(false);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount === 0 && invalidIds.length === 0) {
      showSuccess(`نمره ${successCount} دانش‌آموز با موفقیت ثبت شد`);
    } else if (successCount === 0) {
      showError(`ثبت نمرات انجام نشد (${failCount + invalidIds.length} مورد با خطا مواجه شد)`);
    } else {
      showError(
        `${successCount} مورد ثبت شد — ${failCount + invalidIds.length} مورد با خطا مواجه شد و نیاز به تلاش مجدد دارد`,
      );
    }
  }

  const columns: TableColumn<Student>[] = [
    {
      key: 'fullName',
      header: 'نام دانش‌آموز',
      render: (s) => (
        <div>
          <div className="font-medium text-ink dark:text-paper">{s.fullName}</div>
          {rowFor(s.id).error && <div className="mt-0.5 text-xs text-overdue">{rowFor(s.id).error}</div>}
        </div>
      ),
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
            placeholder="ثبت نشده"
            containerClassName="min-w-[110px]"
          />
        );
      },
    },
    {
      key: 'badge',
      header: '',
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
      header: 'یادداشت (اختیاری)',
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
          <Button variant="primary" onClick={handleSaveAll} disabled={!canSave} loading={saving}>
            ذخیره نمرات
          </Button>
        }
      />

      <FilterBar>
        <Select
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          placeholder="انتخاب پایه"
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
          placeholder="انتخاب ترم"
          options={TERM_OPTIONS}
          containerClassName="min-w-[150px]"
        />
      </FilterBar>

      <Card>
        {!ready ? (
          <EmptyState
            message="ابتدا پایه، درس و ترم را انتخاب کنید"
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
            loading={studentsQuery.isLoading}
            skeletonRows={5}
            emptyMessage="دانش‌آموزی یافت نشد."
            emptyDescription="در این پایه دانش‌آموزی ثبت نشده است."
          />
        )}
      </Card>
    </div>
  );
}

// TODO (out of scope for this feature):
//   - Assessment history: a read view of previously recorded scores (no
//     GET route for a single student/subject/term is wired into the
//     frontend yet; the backend module owns a report-card builder but
//     TeacherController doesn't expose a GET /teacher/assessments route).
//   - Editing a past term's assessment from a history view (today's page
//     only ever resubmits for the currently selected subject+term).
//   - Teacher Homework page is implemented separately — see
//     pages/teacher/TeacherHomeworkPage.tsx.
