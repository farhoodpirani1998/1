import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { InfoRow } from '../../components/InfoRow';
import { SectionHeader } from '../../components/SectionHeader';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards, SkeletonRows } from '../../components/Skeleton';
import { useTeacherProfile, useTeacherClasses, useTeacherSubjects } from '../../hooks/useTeacher';
import { TeacherIcon, ClassIcon, SubjectIcon } from '../../components/icons/SchoolIcons';

// Sprint 1 scope only: profile + assigned classes + assigned subjects,
// no charts, no attendance/homework/assessment data (those are separate
// sprints — see TeacherController on the backend for the full route
// list already implemented there).
export function TeacherDashboardPage() {
  const profileQuery = useTeacherProfile();
  const classesQuery = useTeacherClasses();
  const subjectsQuery = useTeacherSubjects();

  const profile = profileQuery.data;
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];

  // Profile is required to render anything else on the page (header,
  // stat cards, and info panel all read from it), so its loading/error
  // state gates the whole page. Classes/subjects are independent,
  // secondary panels — their own loading/error/empty states are handled
  // locally below so one failing request doesn't blank out data the
  // other two loaded fine.
  if (profileQuery.isLoading) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری اطلاعات معلم"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => profileQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" description={profile?.fullName} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="نام معلم" value={profile?.fullName ?? '—'} icon={<TeacherIcon />} />
        <StatCard
          label="تعداد کلاس‌ها"
          value={classesQuery.isLoading ? '—' : classesQuery.isError ? '؟' : String(classes.length)}
          accent={classesQuery.isError ? 'overdue' : 'action'}
          icon={<ClassIcon />}
        />
        <StatCard
          label="تعداد دروس"
          value={subjectsQuery.isLoading ? '—' : subjectsQuery.isError ? '؟' : String(subjects.length)}
          accent={subjectsQuery.isError ? 'overdue' : 'paid'}
          icon={<SubjectIcon />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="اطلاعات معلم" />
          <Card>
            <InfoRow label="نام و نام خانوادگی" value={profile?.fullName ?? '—'} />
            <InfoRow label="شماره تلفن" value={profile?.phone ?? '—'} />
            <InfoRow label="وضعیت" value={profile?.isActive ? 'فعال' : 'غیرفعال'} />
          </Card>
        </div>

        <div>
          <SectionHeader title="کلاس‌های تخصیص‌یافته" />
          <Card>
            {classesQuery.isLoading ? (
              <SkeletonRows rows={3} cols={1} />
            ) : classesQuery.isError ? (
              <EmptyState
                message="خطا در بارگذاری کلاس‌ها"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button variant="secondary" size="sm" onClick={() => classesQuery.refetch()}>
                    تلاش مجدد
                  </Button>
                }
              />
            ) : classes.length > 0 ? (
              <ul className="divide-y divide-line dark:divide-white/10">
                {classes.map((c) => (
                  <li key={c.id} className="py-2 text-sm text-ink dark:text-paper">
                    {c.title}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="هنوز کلاسی تخصیص داده نشده است" />
            )}
          </Card>

          <SectionHeader title="دروس تخصیص‌یافته" className="mt-6" />
          <Card>
            {subjectsQuery.isLoading ? (
              <SkeletonRows rows={3} cols={1} />
            ) : subjectsQuery.isError ? (
              <EmptyState
                message="خطا در بارگذاری دروس"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button variant="secondary" size="sm" onClick={() => subjectsQuery.refetch()}>
                    تلاش مجدد
                  </Button>
                }
              />
            ) : subjects.length > 0 ? (
              <ul className="divide-y divide-line dark:divide-white/10">
                {subjects.map((s) => (
                  <li key={s.id} className="py-2 text-sm text-ink dark:text-paper">
                    {s.title}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="هنوز درسی تخصیص داده نشده است" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}


