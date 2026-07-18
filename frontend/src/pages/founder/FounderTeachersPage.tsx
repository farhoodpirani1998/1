import { useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Table, type TableColumn } from '../../components/Table';
import { useFounderSchoolTeachers } from '../../hooks/useFounder';
import type { FounderTeacher } from '../../types/founder.types';

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

// Grade/subject pairs render as small tags under the teacher's name — no
// dedicated "assignments" column, since a teacher can have several (see
// founder-frontend-prompt.md §2.5).
function AssignmentTags({ assignments }: { assignments: FounderTeacher['assignments'] }) {
  if (assignments.length === 0) {
    return <span className="text-xs text-ink/40 dark:text-paper/40">بدون تخصیص</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {assignments.map((a) => (
        <span
          key={`${a.gradeId}-${a.subjectId}`}
          className="rounded-md bg-action-soft px-2 py-0.5 text-xs text-action dark:bg-action/15 dark:text-action-light"
        >
          {a.gradeTitle} · {a.subjectTitle}
        </span>
      ))}
    </div>
  );
}

export function FounderTeachersPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const teachersQuery = useFounderSchoolTeachers(schoolId);
  const teachers = teachersQuery.data ?? [];
  const loading = teachersQuery.isLoading;

  const columns: TableColumn<FounderTeacher>[] = [
    {
      key: 'name',
      header: 'معلم',
      render: (t) => (
        <div>
          <div className="font-medium text-ink dark:text-paper">{t.fullName}</div>
          <div className="mt-1.5">
            <AssignmentTags assignments={t.assignments} />
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'تلفن', cellClassName: 'tabular text-ink/70 dark:text-paper/70', render: (t) => t.phone },
    { key: 'status', header: 'وضعیت', render: (t) => <ActiveBadge isActive={t.isActive} /> },
  ];

  return (
    <Card>
      <Table
        columns={columns}
        data={teachers}
        rowKey={(t) => t.id}
        loading={loading}
        skeletonRows={6}
        emptyMessage="معلمی برای این مدرسه ثبت نشده است."
      />
    </Card>
  );
}
