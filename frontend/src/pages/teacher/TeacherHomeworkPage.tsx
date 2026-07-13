// Teacher Homework.
//
// Backend is frozen for this feature: GET/POST/PUT/DELETE /teacher/homework
// already exist on TeacherController (see
// backend/src/modules/teacher/teacher.controller.ts and homework.service.ts).
// A homework row belongs to exactly one of the calling teacher's own
// assigned (grade, subject) pairs — HomeworkService.assertAssigned()
// rejects anything else with 403 — so the create/edit form picks an
// "assignment" (grade+subject together) from the teacher's own profile
// rather than two independent Selects that could be crossed into an
// invalid combination.
//
// Mirrors the CRUD shape of TeacherAssignmentsPage (Table + Modal +
// ConfirmDialog, FormError for server-side validation) rather than
// TeacherAttendancePage/TeacherAssessmentsPage's per-row batch editor —
// homework is a handful of distinct records a teacher creates/edits one
// at a time, not one row per student.
//
// academicYearId: CreateHomeworkDto/UpdateHomeworkDto both require it,
// but there is no teacher-facing endpoint to list academic years —
// GET /academic-years is @Roles('school_admin', 'accountant', 'staff')
// only, and the backend is frozen for this feature. Instead, the id is
// auto-detected from data the teacher *can* already read: their own
// timetable entries and any homework they've already posted both carry
// academicYearId. See resolveAcademicYearOptions() below and the TODO at
// the bottom of this file.
//
// This must be resolved from the teacher's *full* homework history, not
// the grade/subject-filtered list shown in the table — otherwise
// changing the page filters would change which academic years the
// create/edit form offers, which has nothing to do with the filters.
// See allHomeworkQuery below.

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { FilterBar } from '../../components/FilterBar';
import { Select } from '../../components/Select';
import { Input } from '../../components/Input';
import { Field } from '../../components/Field';
import { Table, type TableColumn } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormError } from '../../components/FormError';
import { useToast } from '../../lib/toast';
import { parseApiError, getErrorMessage, type ParsedApiError } from '../../lib/error-handler';
import { formatDate } from '../../lib/format';
import {
  useTeacherProfile,
  useTeacherClasses,
  useTeacherSubjects,
  useTeacherHomework,
  useTeacherTimetable,
  useCreateHomework,
  useUpdateHomework,
  useDeleteHomework,
} from '../../hooks/useTeacher';
import type { HomeworkView, CreateHomeworkInput, UpdateHomeworkInput } from '../../api/teacher.api';

// Every distinct academicYearId visible anywhere in the teacher's own
// data — timetable entries first (the teacher's active schedule, so the
// most likely "current" year), then any academic years already used on
// their own past homework. Deduplicated, order preserved.
function resolveAcademicYearOptions(
  timetable: { academicYearId: string }[],
  homework: { academicYearId: string }[],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of [...timetable, ...homework]) {
    if (!seen.has(entry.academicYearId)) {
      seen.add(entry.academicYearId);
      ids.push(entry.academicYearId);
    }
  }
  return ids;
}

interface FormState {
  assignmentKey: string; // `${gradeId}::${subjectId}`, matched against profile.assignments
  academicYearId: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl: string;
}

const EMPTY_FORM: FormState = {
  assignmentKey: '',
  academicYearId: '',
  title: '',
  description: '',
  dueDate: '',
  attachmentUrl: '',
};

function isOverdue(dueDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

export function TeacherHomeworkPage() {
  const { showSuccess, showError } = useToast();

  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const profileQuery = useTeacherProfile();
  const classesQuery = useTeacherClasses();
  const subjectsQuery = useTeacherSubjects();
  const timetableQuery = useTeacherTimetable();
  const homeworkQuery = useTeacherHomework({
    gradeId: gradeFilter || undefined,
    subjectId: subjectFilter || undefined,
  });
  // Unfiltered — used only to resolve academicYearOptions below. Kept
  // separate from homeworkQuery (the grade/subject-filtered list backing
  // the table) so changing the page filters never changes which academic
  // years the create/edit form offers. Own cache entry (queryKeys.teacher.homework({}))
  // distinct from any filtered variant, so this doesn't disturb the
  // table's query or its cache.
  const allHomeworkQuery = useTeacherHomework();
  const createHomework = useCreateHomework();
  const updateHomework = useUpdateHomework();
  const deleteHomework = useDeleteHomework();

  const assignments = profileQuery.data?.assignments ?? [];
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const homework = homeworkQuery.data ?? [];
  const allHomework = allHomeworkQuery.data ?? [];
  const timetable = timetableQuery.data ?? [];

  const academicYearOptions = useMemo(
    () => resolveAcademicYearOptions(timetable, allHomework),
    [timetable, allHomework],
  );

  const [editing, setEditing] = useState<HomeworkView | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<ParsedApiError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomeworkView | null>(null);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(hw: HomeworkView) {
    setEditing(hw);
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }

  function handleSubmit(assignment: { gradeId: string; subjectId: string }, form: FormState) {
    setFormError(null);
    const attachmentUrl = form.attachmentUrl.trim();

    if (editing) {
      const dto: UpdateHomeworkInput = {
        academicYearId: form.academicYearId,
        gradeId: assignment.gradeId,
        subjectId: assignment.subjectId,
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
        attachmentUrl: attachmentUrl || null,
      };
      updateHomework.mutate(
        { id: editing.id, dto },
        {
          onSuccess: () => {
            showSuccess('تکلیف با موفقیت ویرایش شد');
            closeForm();
          },
          onError: (err) => {
            setFormError(parseApiError(err));
            showError(getErrorMessage(err));
          },
        },
      );
    } else {
      const dto: CreateHomeworkInput = {
        academicYearId: form.academicYearId,
        gradeId: assignment.gradeId,
        subjectId: assignment.subjectId,
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      };
      createHomework.mutate(dto, {
        onSuccess: () => {
          showSuccess('تکلیف با موفقیت ثبت شد');
          closeForm();
        },
        onError: (err) => {
          setFormError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteHomework.mutate(deleteTarget.id, {
      onSuccess: () => {
        showSuccess('تکلیف حذف شد');
        setDeleteTarget(null);
      },
      onError: (err) => {
        showError(getErrorMessage(err));
        setDeleteTarget(null);
      },
    });
  }

  const columns: TableColumn<HomeworkView>[] = [
    {
      key: 'dueDate',
      header: 'مهلت انجام',
      render: (hw) => (
        <div>
          <div className="font-medium text-ink dark:text-paper">{formatDate(hw.dueDate)}</div>
          {isOverdue(hw.dueDate) && (
            <span className="badge mt-1 bg-overdue/10 text-overdue border-overdue/25">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              سررسید گذشته
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'grade',
      header: 'پایه',
      render: (hw) => hw.gradeTitle ?? hw.gradeId,
    },
    {
      key: 'subject',
      header: 'درس',
      render: (hw) => hw.subjectTitle ?? hw.subjectId,
    },
    {
      key: 'title',
      header: 'عنوان',
      render: (hw) => (
        <div>
          <div className="font-medium text-ink dark:text-paper">{hw.title}</div>
          <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-ink/50 dark:text-paper/50">
            {hw.description}
          </div>
        </div>
      ),
    },
    {
      key: 'attachment',
      header: 'پیوست',
      render: (hw) =>
        hw.attachmentUrl ? (
          <a
            href={hw.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-navy underline dark:text-action"
          >
            مشاهده فایل
          </a>
        ) : (
          <span className="text-ink/35 dark:text-paper/35">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'left',
      render: (hw) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEdit(hw)}>
            ویرایش
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(hw)}>
            حذف
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="تکالیف"
        description="مدیریت تکالیف کلاس‌های تخصیص‌یافته به شما"
        actions={
          <Button variant="primary" onClick={openCreate} disabled={assignments.length === 0}>
            + تکلیف جدید
          </Button>
        }
      />

      <FilterBar>
        <Select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          placeholder="همه پایه‌ها"
          options={classes.map((c) => ({ value: c.id, label: c.title }))}
          containerClassName="min-w-[180px]"
        />
        <Select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          placeholder="همه دروس"
          options={subjects.map((s) => ({ value: s.id, label: s.title }))}
          containerClassName="min-w-[180px]"
        />
      </FilterBar>

      <Card>
        {homeworkQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری تکالیف"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => homeworkQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={homework}
            rowKey={(hw) => hw.id}
            loading={homeworkQuery.isLoading}
            skeletonRows={5}
            emptyMessage="هنوز تکلیفی ثبت نشده است."
            emptyDescription="برای شروع، از دکمه «تکلیف جدید» استفاده کنید."
          />
        )}
      </Card>

      <HomeworkFormModal
        open={showForm}
        editing={editing}
        assignments={assignments}
        academicYearOptions={academicYearOptions}
        saving={createHomework.isPending || updateHomework.isPending}
        error={formError}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف تکلیف"
        description="آیا از حذف این تکلیف مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        confirmLabel="حذف"
        variant="danger"
        loading={deleteHomework.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function HomeworkFormModal({
  open,
  editing,
  assignments,
  academicYearOptions,
  saving,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  editing: HomeworkView | null;
  assignments: { id: string; gradeId: string; gradeTitle?: string; subjectId: string; subjectTitle?: string }[];
  academicYearOptions: string[];
  saving: boolean;
  error: ParsedApiError | null;
  onSubmit: (assignment: { gradeId: string; subjectId: string }, form: FormState) => void;
  onClose: () => void;
}) {
  // The modal is mounted once by the parent page (not remounted per
  // row), so its form state is reset whenever the target it's editing
  // changes — a fresh EMPTY_FORM (with a sensible default assignment +
  // auto-detected academic year) when opened for "new", or the existing
  // record's fields when opened for "edit". Same "reset local editor
  // state on a key change" shape as TeacherAssessmentsPage resetting
  // `rows` when grade/subject/term changes.
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        assignmentKey: `${editing.gradeId}::${editing.subjectId}`,
        academicYearId: editing.academicYearId,
        title: editing.title,
        description: editing.description,
        dueDate: editing.dueDate,
        attachmentUrl: editing.attachmentUrl ?? '',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        assignmentKey: assignments.length > 0 ? `${assignments[0].gradeId}::${assignments[0].subjectId}` : '',
        academicYearId: academicYearOptions.length === 1 ? academicYearOptions[0] : '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // academicYearOptions is resolved from the timetable/homework queries,
  // which can still be loading (or can finish loading later) at the
  // moment the effect above ran — e.g. the form is opened for "new"
  // before that data arrives, so academicYearId gets set to '' above.
  // Re-run auto-selection once a single option becomes available, but
  // only to fill an empty field — never clobber a year the user already
  // picked or typed, and never touch edit mode (which always starts from
  // the record's own academicYearId).
  useEffect(() => {
    if (!open || editing) return;
    if (academicYearOptions.length !== 1) return;
    setForm((f) => (f.academicYearId ? f : { ...f, academicYearId: academicYearOptions[0] }));
  }, [open, editing, academicYearOptions]);

  // The assignment currently being edited may no longer be in the
  // teacher's live `assignments` list (e.g. a school_admin removed or
  // changed that grade/subject assignment after this homework record was
  // created). The Select must still be able to display it, so it's added
  // as a synthetic option rather than silently dropped.
  const editingAssignmentKey = editing ? `${editing.gradeId}::${editing.subjectId}` : null;
  const hasEditingAssignment = editing
    ? assignments.some((a) => `${a.gradeId}::${a.subjectId}` === editingAssignmentKey)
    : true;

  const assignmentOptions = useMemo(() => {
    const options = assignments.map((a) => ({
      value: `${a.gradeId}::${a.subjectId}`,
      label: `${a.gradeTitle ?? a.gradeId} — ${a.subjectTitle ?? a.subjectId}`,
    }));
    if (editing && !hasEditingAssignment) {
      options.push({
        value: editingAssignmentKey as string,
        label: `${editing.gradeTitle ?? editing.gradeId} — ${editing.subjectTitle ?? editing.subjectId}`,
      });
    }
    return options;
  }, [assignments, editing, hasEditingAssignment, editingAssignmentKey]);

  const selectedAssignment =
    assignments.find((a) => `${a.gradeId}::${a.subjectId}` === form.assignmentKey) ??
    (editing && form.assignmentKey === editingAssignmentKey
      ? { gradeId: editing.gradeId, subjectId: editing.subjectId }
      : undefined);
  const needsManualYear = academicYearOptions.length === 0;
  const needsYearChoice = academicYearOptions.length > 1;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedAssignment) return;
    onSubmit({ gradeId: selectedAssignment.gradeId, subjectId: selectedAssignment.subjectId }, form);
  }

  const canSubmit =
    !!selectedAssignment &&
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    !!form.dueDate &&
    !!form.academicYearId.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'ویرایش تکلیف' : 'تکلیف جدید'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          required
          label="پایه و درس"
          value={form.assignmentKey}
          onChange={(e) => setForm((f) => ({ ...f, assignmentKey: e.target.value }))}
          placeholder="انتخاب پایه و درس"
          options={assignmentOptions}
          containerClassName="sm:col-span-2"
          helperText={
            assignments.length === 0
              ? 'شما هنوز به هیچ پایه و درسی تخصیص داده نشده‌اید.'
              : undefined
          }
        />

        {needsYearChoice ? (
          <Select
            required
            label="سال تحصیلی"
            value={form.academicYearId}
            onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}
            placeholder="انتخاب سال تحصیلی"
            options={academicYearOptions.map((id) => ({ value: id, label: id }))}
            containerClassName="sm:col-span-2"
            helperText="چند سال تحصیلی در سوابق شما یافت شد — سال مورد نظر را انتخاب کنید."
          />
        ) : needsManualYear ? (
          <Input
            required
            label="سال تحصیلی (شناسه)"
            value={form.academicYearId}
            onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}
            placeholder="شناسه سال تحصیلی"
            containerClassName="sm:col-span-2"
            helperText="سال تحصیلی به‌صورت خودکار یافت نشد؛ لطفاً شناسه آن را وارد کنید."
          />
        ) : null}

        <Input
          required
          type="date"
          label="مهلت انجام"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
        />

        <Input
          type="url"
          label="لینک پیوست (اختیاری)"
          value={form.attachmentUrl}
          onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
          placeholder="https://..."
        />

        <Input
          required
          label="عنوان"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="مثلاً: تمرین فصل سوم"
          containerClassName="sm:col-span-2"
        />

        <Field label="توضیحات" required className="sm:col-span-2">
          <textarea
            required
            rows={4}
            className="input"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="جزئیات تکلیف را بنویسید..."
          />
        </Field>

        <div className="sm:col-span-2">
          <FormError error={error} />
          <div className="flex gap-2">
            <Button type="submit" loading={saving} disabled={!canSubmit}>
              {editing ? 'ذخیره تغییرات' : 'ثبت تکلیف'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              انصراف
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// TODO (Teacher Announcements — out of scope for this feature):
//   - GET /teacher/announcements already exists on the backend
//     (Phase 5H), unimplemented on the frontend — TeacherComingSoonPage
//     still serves /teacher/announcements.
//
// Known limitation carried into this feature (see the module comment at
// the top of this file): there is no teacher-facing endpoint to list
// academic years, so academicYearId is auto-detected from the teacher's
// own timetable/homework data rather than offered as a proper reference
// picker. A teacher with neither timetable entries nor prior homework
// must type the id manually. Fixing this properly means either adding
// 'teacher' to GET /academic-years' @Roles(), or a dedicated
// GET /teacher/academic-year(s) route — both are backend changes and are
// out of scope here per this feature's "do not modify backend" constraint.
