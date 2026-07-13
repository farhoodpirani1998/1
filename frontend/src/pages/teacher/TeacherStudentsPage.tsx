// Teacher Students (teacher self-service portal).
//
// GET /teacher/students, optionally narrowed by gradeId to one of the
// teacher's own assigned grades (GET /teacher/classes powers the grade
// filter — never a school-wide grade list, matching the teacher's own
// assignment scope everywhere else in this portal). Backend is frozen
// for this feature; both routes already exist on TeacherController.
//
// Mirrors the shape of TeacherAssignmentsPage (FilterBar + Table +
// EmptyState-on-error) and reuses StudentsPage's local status-badge
// pattern — a shared <StatusBadge/> exists but is typed strictly for
// InstallmentStatus, not Student['status'], same reasoning StudentsPage
// documents for keeping its own badge local rather than reusing that one.

import { useState } from 'react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { FilterBar } from '../../components/FilterBar';
import { Select } from '../../components/Select';
import { Table, type TableColumn } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../lib/format';
import { useTeacherClasses, useTeacherStudents } from '../../hooks/useTeacher';
import type { Student } from '../../types/student.types';

const statusLabels: Record<Student['status'], string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

const statusBadgeClass: Record<Student['status'], string> = {
  active: 'bg-paid/10 text-paid border-paid/25',
  withdrawn: 'bg-overdue/10 text-overdue border-overdue/25',
  graduated: 'bg-action-soft text-action border-action/25',
};

function StudentStatusBadge({ status }: { status: Student['status'] }) {
  return (
    <span className={`badge ${statusBadgeClass[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

export function TeacherStudentsPage() {
  const [gradeId, setGradeId] = useState('');

  const classesQuery = useTeacherClasses();
  const studentsQuery = useTeacherStudents(gradeId || undefined);

  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isLoading;
  const isError = studentsQuery.isError;

  const columns: TableColumn<Student>[] = [
    {
      key: 'fullName',
      header: 'نام دانش‌آموز',
      render: (s) => s.fullName,
    },
    {
      key: 'grade',
      header: 'پایه',
      render: (s) => s.grade?.title ?? '—',
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (s) => <StudentStatusBadge status={s.status} />,
    },
    {
      key: 'enrollmentDate',
      header: 'تاریخ ثبت‌نام',
      cellClassName: 'text-ink/60 dark:text-paper/60',
      render: (s) => (s.enrollmentDate ? formatDate(s.enrollmentDate) : '—'),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="دانش‌آموزان" description="دانش‌آموزان کلاس‌های تخصیص‌یافته به شما" />

      <FilterBar>
        <Select
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          placeholder="همه پایه‌ها"
          options={classes.map((c) => ({ value: c.id, label: c.title }))}
          containerClassName="min-w-[200px]"
        />
      </FilterBar>

      <Card>
        {isError ? (
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
            loading={loading}
            skeletonRows={5}
            emptyMessage="دانش‌آموزی یافت نشد."
            emptyDescription={
              gradeId ? 'در این پایه دانش‌آموزی ثبت نشده است.' : 'هنوز کلاسی به شما تخصیص داده نشده است.'
            }
          />
        )}
      </Card>
    </div>
  );
}
