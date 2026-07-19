// ---------------------------------------------------------------------
// «قسمت دریافت تکالیف» — flagged «خیلی مهم» in the homework-page review.
// Backed entirely by api/homeworkSubmissions.mock.ts — see that file's
// header comment for why (no submissions concept exists on the backend
// yet). Opened from TeacherHomeworkPage via a per-row "ارسال‌ها" button.
// ---------------------------------------------------------------------

import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { formatRelativeTime } from '../lib/format';
import {
  useHomeworkSubmissions,
  useGradeSubmission,
  useReturnSubmission,
} from '../hooks/useHomeworkExtras';
import { useToast } from '../lib/toast';
import type { HomeworkSubmission, SubmissionStatus } from '../types/homeworkExtras.types';

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; className: string }> = {
  submitted: { label: 'ارسال‌شده — در انتظار بررسی', className: 'bg-warning/10 text-warning border-warning/25' },
  graded: { label: 'نمره‌دهی‌شده', className: 'bg-paid/10 text-paid border-paid/25' },
  returned: { label: 'برگردانده‌شده برای اصلاح', className: 'bg-overdue/10 text-overdue border-overdue/25' },
};

export function HomeworkSubmissionsModal({
  open,
  onClose,
  homeworkId,
  homeworkTitle,
}: {
  open: boolean;
  onClose: () => void;
  homeworkId: string | null;
  homeworkTitle: string;
}) {
  const submissionsQuery = useHomeworkSubmissions(homeworkId ?? undefined);
  const submissions = submissionsQuery.data ?? [];
  const [previewTarget, setPreviewTarget] = useState<HomeworkSubmission | null>(null);

  return (
    <>
      <Modal open={open} onClose={onClose} title={`ارسال‌های تکلیف: ${homeworkTitle}`} size="lg">
        {submissionsQuery.isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-16 w-full rounded-lg" />
            <div className="skeleton h-16 w-full rounded-lg" />
            <div className="skeleton h-16 w-full rounded-lg" />
          </div>
        ) : submissionsQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری ارسال‌ها"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => submissionsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : submissions.length === 0 ? (
          <EmptyState message="هنوز دانش‌آموزی تکلیف را ارسال نکرده است." />
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                homeworkId={homeworkId as string}
                onPreview={() => setPreviewTarget(submission)}
              />
            ))}
          </div>
        )}
      </Modal>

      <SubmissionPreviewModal submission={previewTarget} onClose={() => setPreviewTarget(null)} />
    </>
  );
}

function SubmissionRow({
  submission,
  homeworkId,
  onPreview,
}: {
  submission: HomeworkSubmission;
  homeworkId: string;
  onPreview: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const gradeSubmission = useGradeSubmission(homeworkId);
  const returnSubmission = useReturnSubmission(homeworkId);

  const [gradeValue, setGradeValue] = useState(submission.grade != null ? String(submission.grade) : '');
  const [commentValue, setCommentValue] = useState(submission.comment ?? '');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnComment, setReturnComment] = useState('');

  const status = STATUS_CONFIG[submission.status];

  function handleSaveGrade() {
    const grade = Number(gradeValue);
    if (!gradeValue.trim() || Number.isNaN(grade)) {
      showError('نمره را به‌صورت عدد وارد کنید.');
      return;
    }
    gradeSubmission.mutate(
      { submissionId: submission.id, grade, comment: commentValue },
      {
        onSuccess: () => showSuccess('نمره و نظر ثبت شد'),
        onError: () => showError('ثبت نمره با خطا مواجه شد.'),
      },
    );
  }

  function handleReturn() {
    if (!returnComment.trim()) {
      showError('برای برگرداندن تکلیف، توضیح اصلاح را بنویسید.');
      return;
    }
    returnSubmission.mutate(
      { submissionId: submission.id, comment: returnComment },
      {
        onSuccess: () => {
          showSuccess('تکلیف برای اصلاح برگردانده شد');
          setShowReturnForm(false);
          setReturnComment('');
        },
        onError: () => showError('عملیات با خطا مواجه شد.'),
      },
    );
  }

  return (
    <div className="rounded-lg border border-line p-3 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink dark:text-paper">{submission.studentName}</div>
          <div className="mt-0.5 text-xs text-ink/50 dark:text-paper/50">
            {submission.fileName} · ارسال {formatRelativeTime(submission.submittedAt)}
          </div>
        </div>
        <span className={`badge ${status.className}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onPreview}>
          {submission.fileType === 'pdf' ? 'مشاهده PDF' : 'مشاهده عکس'}
        </Button>
        <a href={submission.fileUrl} download target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm" type="button">
            دانلود فایل
          </Button>
        </a>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowReturnForm((v) => !v)}
        >
          برگرداندن برای اصلاح
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_auto]">
        <input
          type="number"
          className="input"
          placeholder="نمره"
          value={gradeValue}
          onChange={(e) => setGradeValue(e.target.value)}
        />
        <input
          type="text"
          className="input"
          placeholder="نظر معلم (اختیاری)"
          value={commentValue}
          onChange={(e) => setCommentValue(e.target.value)}
        />
        <Button size="sm" onClick={handleSaveGrade} loading={gradeSubmission.isPending}>
          ثبت نمره
        </Button>
      </div>

      {showReturnForm && (
        <div className="mt-3 rounded-md bg-overdue/5 p-3">
          <textarea
            className="input"
            rows={2}
            placeholder="توضیح اینکه دانش‌آموز چه چیزی را باید اصلاح کند..."
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <Button variant="danger" size="sm" onClick={handleReturn} loading={returnSubmission.isPending}>
              تایید برگرداندن
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowReturnForm(false)}>
              انصراف
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionPreviewModal({
  submission,
  onClose,
}: {
  submission: HomeworkSubmission | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!submission}
      onClose={onClose}
      title={submission ? `${submission.fileName} — ${submission.studentName}` : ''}
      size="lg"
    >
      {submission?.fileType === 'image' ? (
        <img src={submission.fileUrl} alt={submission.fileName} className="max-h-[70vh] w-full rounded-md object-contain" />
      ) : submission ? (
        <iframe src={submission.fileUrl} title={submission.fileName} className="h-[70vh] w-full rounded-md border border-line dark:border-white/10" />
      ) : null}
    </Modal>
  );
}
