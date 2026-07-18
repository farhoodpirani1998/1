import { useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Table, type TableColumn } from '../../components/Table';
import { EmptyState } from '../../components/EmptyState';
import { useFounderTeachers } from '../../hooks/useFounder';
import type { FounderTeacherWithSchool } from '../../types/founder.types';

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`badge ${isActive ? 'bg-paid/10 text-paid border-paid/25' : 'bg-overdue/10 text-overdue border-overdue/25'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isActive ? 'فعال' : 'غیرفعال'}
    </span>
  );
}

function AssignmentTags({ assignments }: { assignments: FounderTeacherWithSchool['assignments'] }) {
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

// Cross-school teacher directory (GET /founder/teachers) — read-only,
// no create button (a founder never creates staff logins; teachers are
// created from the school_admin side). Distinct from the per-school
// /founder/schools/:schoolId/teachers page: this one spans every school
// the founder owns at once, grouped by school.
export function FounderAllTeachersPage() {
  const teachersQuery = useFounderTeachers();
  const teachers = teachersQuery.data ?? [];
  const loading = teachersQuery.isLoading;

  const bySchool = useMemo(() => {
    const groups = new Map<string, { schoolName: string; teachers: FounderTeacherWithSchool[] }>();
    for (const t of teachers) {
      const group = groups.get(t.schoolId) ?? { schoolName: t.schoolName, teachers: [] };
      group.teachers.push(t);
      groups.set(t.schoolId, group);
    }
    return Array.from(groups.entries()).sort((a, b) => a[1].schoolName.localeCompare(b[1].schoolName, 'fa'));
  }, [teachers]);

  const columns: TableColumn<FounderTeacherWithSchool>[] = [
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
    <div className="fade-in">
      <PageHeader title="معلمان" description="معلمان همه‌ی مدارس متعلق به شما" />

      {!loading && teachers.length === 0 ? (
        <Card>
          <EmptyState message="معلمی در هیچ‌کدام از مدارس شما ثبت نشده است." />
        </Card>
      ) : loading ? (
        <Card>
          <Table columns={columns} data={[]} rowKey={(t) => t.id} loading skeletonRows={6} />
        </Card>
      ) : (
        <div className="space-y-6">
          {bySchool.map(([schoolId, group]) => (
            <Card key={schoolId} title={group.schoolName}>
              <Table
                stickyHeader
                columns={columns}
                data={group.teachers}
                rowKey={(t) => t.id}
                emptyMessage="معلمی برای این مدرسه ثبت نشده است."
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
