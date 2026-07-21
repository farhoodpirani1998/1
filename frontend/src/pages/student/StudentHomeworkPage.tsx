import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards } from '../../components/Skeleton';
import { Table, type TableColumn } from '../../components/Table';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormError } from '../../components/FormError';
import { AssignmentsIcon } from '../../components/icons/SchoolIcons';
import { formatDate, toPersianDigits } from '../../lib/format';
import { useToast } from '../../lib/toast';
import { parseApiError, getErrorMessage, type ParsedApiError } from '../../lib/error-handler';
import { useStudentHomework, useSubmitHomework } from '../../hooks/useStudentPortal';
import type { StudentHomeworkView } from '../../types/studentPortal.types';

// Task 5B-C — /student/homework. The signed-in student's own assigned
// homework, backed by GET /student/homework (useStudentHomework) only —
// no other query, no direct API call, no duplicated state/business logic.
//
// Sprint H2 adds the page's one write: a per-row Submit/Resubmit action
// backed by POST /student/homework/:homeworkId/submit (useSubmitHomework,
// hooks/useStudentPortal.ts), confirmed via the shared ConfirmDialog
// rather than firing on click — same "confirm before a state-changing
// action" shape used elsewhere in the app (VoidPaymentDialog, delete
// flows). No new architecture: the mutation invalidates
// queryKeys.studentPortal.homework() only (no manual cache patch), so the
// table's own useStudentHomework() query refetches and every column
// (badge, submittedAt, action button) updates from that one refetch —
// there is no second, hand-maintained copy of "this row's status" on this
// page. Errors surface both as a toast (useToast, matching every other
// mutation in the app) and inline via the shared FormError, so the retry
// path is just reopening/reconfirming the same dialog — no bespoke retry
// logic is introduced.
//
// Design reference: same "stat row + records Table" shape as
// StudentAttendancePage (loading → SkeletonCards, error → EmptyState +
// retry, matching the Teacher Portal convention already used there), plus
// ParentHomeworkPage's column set (due date/subject/title/teacher/
// attachment) for the read-only homework Table itself. submissionStatus
// is the one field neither of those pages needs to render, so its
// label/badge/overdue rules below are new but follow the exact same
// "local Record<Status, ...> map + small Badge component" pattern
// StudentDashboardPage/StudentAttendancePage already use for
// AttendanceStatus.
//
// submissionStatus values mirror the backend HomeworkSubmissionStatus
// enum (see backend/src/modules/homework/entities/homework-submission.entity.ts):
// 'pending' | 'submitted' | 'late' | 'missing', or null when no
// submission row exists yet at all (StudentHomeworkView's own doc
// comment: "a missing row is a normal, not-yet-submitted state, not an
// error"). Per that same module's resolveSubmittedAt() comment, only
// 'submitted'/'late' mean the student actually submitted something —
// null/'pending'/'missing' all mean they haven't. That's the exact rule
// used below to split "submitted" from "pending" homework.

type SubmissionStatusValue = 'pending' | 'submitted' | 'late' | 'missing';

// Folds the null ("no submission row yet") case in with the explicit
// 'pending' status — both render identically, as "نشده ارسال هنوز".
function resolveStatus(submissionStatus: string | null): SubmissionStatusValue {
  if (submissionStatus === 'submitted' || submissionStatus === 'late' || submissionStatus === 'missing') {
    return submissionStatus;
  }
  return 'pending';
}

// Same rule as the backend's own resolveSubmittedAt(): 'submitted'/'late'
// mean the student actually submitted something; 'pending'/'missing'
// (or no row at all) mean they haven't.
function isSubmitted(submissionStatus: string | null): boolean {
  return submissionStatus === 'submitted' || submissionStatus === 'late';
}

function isOverdue(dueDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

const SUBMISSION_STATUS_LABEL: Record<SubmissionStatusValue, string> = {
  pending: 'در انتظار ارسال',
  submitted: 'ارسال شده',
  late: 'ارسال با تأخیر',
  missing: 'ارسال نشده',
};

const SUBMISSION_STATUS_BADGE_CLASS: Record<SubmissionStatusValue, string> = {
  pending: 'bg-action-soft text-action border-action/25',
  submitted: 'bg-paid/10 text-paid border-paid/25',
  late: 'bg-warning/10 text-warning border-warning/25',
  missing: 'bg-overdue/10 text-overdue border-overdue/25',
};

function SubmissionStatusBadge({ submissionStatus }: { submissionStatus: string | null }) {
  const status = resolveStatus(submissionStatus);
  return (
    <span className={`badge ${SUBMISSION_STATUS_BADGE_CLASS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {SUBMISSION_STATUS_LABEL[status]}
    </span>
  );
}

export function StudentHomeworkPage() {
  const homeworkQuery = useStudentHomework();
  const submitHomework = useSubmitHomework();
  const { showSuccess, showError } = useToast();

  // The homework row currently targeted by the confirm dialog — null
  // means the dialog is closed. Reused for both the first submission and
  // a resubmit (same endpoint, same upsert-on-resubmit backend behavior —
  // see StudentService.submitMyHomework()'s own doc comment), so there's
  // only ever one dialog/one mutation in flight at a time, never a
  // per-row copy of this state.
  const [actionTarget, setActionTarget] = useState<StudentHomeworkView | null>(null);
  const [actionError, setActionError] = useState<ParsedApiError | null>(null);

  function openAction(hw: StudentHomeworkView) {
    setActionError(null);
    setActionTarget(hw);
  }

  function closeAction() {
    if (submitHomework.isPending) return;
    setActionTarget(null);
    setActionError(null);
  }

  // Also doubles as the retry action: on failure the dialog stays open
  // (closeAction() isn't called from onError below), so clicking confirm
  // again just re-fires the same mutation for the same actionTarget.
  function confirmAction() {
    if (!actionTarget) return;
    setActionError(null);
    submitHomework.mutate(actionTarget.id, {
      onSuccess: () => {
        showSuccess(
          isOverdue(actionTarget.dueDate)
            ? 'تکلیف با تأخیر ثبت شد'
            : 'تکلیف با موفقیت ثبت شد',
        );
        setActionTarget(null);
      },
      onError: (err) => {
        setActionError(parseApiError(err));
        showError(getErrorMessage(err));
      },
    });
  }

  if (homeworkQuery.isLoading) {
    return (
      <div className="fade-in">
        <PageHeader title="تکالیف" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (homeworkQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="تکالیف" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری تکالیف"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => homeworkQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const homework = [...(homeworkQuery.data ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const submittedCount = homework.filter((h) => isSubmitted(h.submissionStatus)).length;
  const pendingCount = homework.filter(
    (h) => !isSubmitted(h.submissionStatus) && !isOverdue(h.dueDate),
  ).length;
  const overdueCount = homework.filter(
    (h) => !isSubmitted(h.submissionStatus) && isOverdue(h.dueDate),
  ).length;

  const columns: TableColumn<StudentHomeworkView>[] = [
    {
      key: 'dueDate',
      header: 'مهلت انجام',
      render: (hw) => (
        <div>
          <div className="font-medium text-ink dark:text-paper">{formatDate(hw.dueDate)}</div>
          {!isSubmitted(hw.submissionStatus) && isOverdue(hw.dueDate) && (
            <span className="badge mt-1 bg-overdue/10 text-overdue border-overdue/25">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              سررسید گذشته
            </span>
          )}
        </div>
      ),
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
          <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-ink/50 dark:text-paper/50">{hw.description}</div>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'معلم',
      render: (hw) => hw.teacherName ?? '—',
    },
    {
      key: 'attachment',
      header: 'پیوست',
      render: (hw) =>
        hw.attachmentUrl ? (
          <a href={hw.attachmentUrl} target="_blank" rel="noreferrer" className="text-navy underline dark:text-action">
            مشاهده فایل
          </a>
        ) : (
          <span className="text-ink/35 dark:text-paper/35">—</span>
        ),
    },
    {
      key: 'submissionStatus',
      header: 'وضعیت ارسال',
      render: (hw) => <SubmissionStatusBadge submissionStatus={hw.submissionStatus} />,
    },
    {
      key: 'submittedAt',
      header: 'تاریخ ارسال',
      render: (hw) => (hw.submittedAt ? formatDate(hw.submittedAt) : '—'),
    },
    {
      key: 'action',
      header: 'اقدام',
      render: (hw) => {
        const pending = submitHomework.isPending && actionTarget?.id === hw.id;
        return (
          <Button
            size="sm"
            variant={isSubmitted(hw.submissionStatus) ? 'secondary' : 'primary'}
            loading={pending}
            disabled={submitHomework.isPending && !pending}
            onClick={() => openAction(hw)}
          >
            {isSubmitted(hw.submissionStatus) ? 'ارسال مجدد' : 'ثبت ارسال'}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="تکالیف" description="تکالیف تعیین‌شده برای شما" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="ارسال شده" value={toPersianDigits(submittedCount)} accent="paid" />
        <StatCard
          label="در انتظار ارسال"
          value={toPersianDigits(pendingCount)}
          accent={pendingCount > 0 ? 'action' : 'default'}
        />
        <StatCard
          label="سررسید گذشته"
          value={toPersianDigits(overdueCount)}
          accent={overdueCount > 0 ? 'overdue' : 'default'}
        />
      </div>

      <div className="mt-6">
        <Card title="لیست تکالیف">
          <FormError error={actionError} />
          <Table
            columns={columns}
            data={homework}
            rowKey={(hw) => hw.id}
            emptyMessage="تکلیفی برای شما ثبت نشده است."
            emptyIcon={<AssignmentsIcon size={28} />}
          />
        </Card>
      </div>

      <ConfirmDialog
        open={actionTarget !== null}
        title={actionTarget && isSubmitted(actionTarget.submissionStatus) ? 'ارسال مجدد تکلیف' : 'ثبت ارسال تکلیف'}
        description={
          actionTarget
            ? isSubmitted(actionTarget.submissionStatus)
              ? `آیا از ثبت مجدد ارسال «${actionTarget.title}» مطمئن هستید؟ وضعیت قبلی این تکلیف جایگزین می‌شود.`
              : isOverdue(actionTarget.dueDate)
                ? `مهلت «${actionTarget.title}» گذشته است. با این حال می‌توانید آن را با تأخیر ثبت کنید.`
                : `آیا از ثبت ارسال «${actionTarget.title}» مطمئن هستید؟`
            : undefined
        }
        confirmLabel={actionTarget && isSubmitted(actionTarget.submissionStatus) ? 'ارسال مجدد' : 'ثبت ارسال'}
        loading={submitHomework.isPending}
        onConfirm={confirmAction}
        onCancel={closeAction}
      />
    </div>
  );
}
