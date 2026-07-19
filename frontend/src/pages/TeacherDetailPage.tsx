// Teacher detail page. Linked from Global Search's "معلمان" group
// (GlobalSearch.tsx) — the first staff-facing detail route for a
// teacher; TeacherAssignmentsPage only ever showed a teacher as a row in
// an assignment table, never as its own page. Read-only: assignment
// management (assign/unassign) stays on TeacherAssignmentsPage, which
// already owns that flow.

import { useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { Breadcrumb } from '../components/Breadcrumb';
import { InfoRow } from '../components/InfoRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { TeacherIcon } from '../components/icons/SchoolIcons';
import { toPersianDigits } from '../lib/format';
import { useTeacherDetail } from '../hooks/useTeacher';

function TeacherAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action-soft text-xl font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

export function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const teacherQuery = useTeacherDetail(id);
  const teacher = teacherQuery.data;

  if (teacherQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="معلم یافت نشد"
            description="ممکن است این کاربر حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="fade-in">
        <div className="mb-6 flex items-center gap-4">
          <div className="skeleton h-14 w-14 rounded-full" />
          <div className="flex-1">
            <div className="skeleton mb-2 h-5 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <Breadcrumb
        className="mb-3"
        items={[{ label: 'معلمان', to: '/teacher-assignments' }, { label: teacher.fullName }]}
      />

      <div className="mb-6 flex items-center gap-4">
        <TeacherAvatar name={teacher.fullName} />
        <div>
          <h1 className="text-xl font-bold text-ink dark:text-paper">{teacher.fullName}</h1>
          <p className="text-sm text-ink/50 dark:text-paper/50">{toPersianDigits(teacher.phone)}</p>
        </div>
        <span
          className={`badge mr-auto ${
            teacher.isActive
              ? 'bg-paid/10 text-paid border-paid/25'
              : 'bg-overdue/10 text-overdue border-overdue/25'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {teacher.isActive ? 'فعال' : 'غیرفعال'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="اطلاعات حساب">
          <InfoRow label="نام کامل" value={teacher.fullName} />
          <InfoRow label="شماره تلفن" value={toPersianDigits(teacher.phone)} />
          <InfoRow label="وضعیت" value={teacher.isActive ? 'فعال' : 'غیرفعال'} />
        </Card>

        <Card title="تخصیص‌های کلاس و درس">
          {teacher.assignments.length === 0 ? (
            <EmptyState icon={<TeacherIcon size={28} />} message="هیچ کلاس/درسی به این معلم تخصیص داده نشده است." />
          ) : (
            <div className="divide-y divide-line dark:divide-white/10">
              {teacher.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-ink dark:text-paper">{a.gradeTitle ?? '—'}</span>
                  <span className="text-xs text-ink/45 dark:text-paper/45">{a.subjectTitle ?? 'همه دروس'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
