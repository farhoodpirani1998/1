// Homework detail page. Linked from Global Search's "تکالیف" group
// (GlobalSearch.tsx) — the first staff-facing detail route for a
// homework row; TeacherHomeworkPage only exposes a teacher's own
// posted homework, never a single-item, school_admin-facing view.
// Read-only: creating/editing homework stays teacher-only
// (POST/PUT/DELETE /teacher/homework), same as before this page existed.

import { useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumb } from '../components/Breadcrumb';
import { InfoRow } from '../components/InfoRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { formatDate } from '../lib/format';
import { useHomeworkDetail } from '../hooks/useHomework';

export function HomeworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const homeworkQuery = useHomeworkDetail(id);
  const homework = homeworkQuery.data;

  if (homeworkQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="تکلیف یافت نشد"
            description="ممکن است این تکلیف حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }

  if (!homework) {
    return (
      <div className="fade-in">
        <div className="mb-6">
          <div className="skeleton mb-2 h-3 w-24" />
          <div className="skeleton h-6 w-48" />
        </div>
        <Card>
          <SkeletonRows rows={4} cols={2} />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: 'تکالیف' }, { label: homework.title }]} />}
        title={homework.title}
        description={`مهلت تحویل: ${formatDate(homework.dueDate)}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="مشخصات">
          <InfoRow label="پایه" value={homework.gradeTitle ?? '—'} />
          <InfoRow label="درس" value={homework.subjectTitle ?? '—'} />
          <InfoRow label="معلم" value={homework.teacherName ?? '—'} />
          <InfoRow label="مهلت تحویل" value={formatDate(homework.dueDate)} />
          {homework.attachmentUrl && (
            <InfoRow
              label="پیوست"
              value={
                <a
                  href={homework.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-action hover:underline"
                >
                  مشاهده پیوست
                </a>
              }
            />
          )}
        </Card>

        <Card title="توضیحات">
          {homework.description ? (
            <p className="whitespace-pre-line text-sm leading-7 text-ink/80 dark:text-paper/80">
              {homework.description}
            </p>
          ) : (
            <EmptyState message="توضیحاتی برای این تکلیف ثبت نشده است." />
          )}
        </Card>
      </div>
    </div>
  );
}
