import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { Table, type TableColumn } from '../../components/Table';
import { formatDate } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentHomework } from '../../hooks/useParent';
import type { ParentHomeworkView } from '../../types/parent.types';

// /parent/homework — homework assigned to the selected child's grade.
// Backed by GET /parent/students/:id/homework, which already existed
// server-side (HomeworkService.findForParent, ownership-checked the
// same way as tuition/installments/payments) but had no frontend
// consumer until now. Read-only — posting homework stays on the teacher
// side (TeacherHomeworkPage).

function isOverdue(dueDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

export function ParentHomeworkPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const homeworkQuery = useStudentHomework(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="تکالیف" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="تکالیف" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const homework = [...(homeworkQuery.data ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const columns: TableColumn<ParentHomeworkView>[] = [
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
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="تکالیف"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      <Card title="لیست تکالیف">
        <Table
          columns={columns}
          data={homework}
          rowKey={(hw) => hw.id}
          loading={homeworkQuery.isLoading}
          emptyMessage="تکلیفی برای این دانش‌آموز ثبت نشده است."
        />
      </Card>
    </div>
  );
}
