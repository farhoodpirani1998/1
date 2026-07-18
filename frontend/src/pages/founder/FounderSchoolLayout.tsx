import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { Breadcrumb } from '../../components/Breadcrumb';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonRows } from '../../components/Skeleton';
import { FounderSchoolSwitcher } from '../../components/founder/FounderSchoolSwitcher';
import { useFounderSchools } from '../../hooks/useFounder';

const TABS: { to: string; label: string }[] = [
  { to: '', label: 'داشبورد' },
  { to: '/students', label: 'دانش‌آموزان' },
  { to: '/teachers', label: 'معلم‌ها' },
  { to: '/staff', label: 'کارمندان' },
  { to: '/tuition', label: 'شهریه' },
];

// Shared chrome for every /founder/schools/:schoolId/* page: breadcrumb,
// school switcher, and an in-page tab bar (see the note on this route
// group in components/Sidebar.tsx — the global sidebar can't express a
// dynamic :schoolId, so this local tab bar carries it instead).
//
// Also owns the "school not found" check. Every schoolId a founder can
// ever navigate to comes from GET /founder/schools (the overview page's
// links, and this layout's own switcher) — landing here with an id
// outside that list means a stale or manipulated URL. The backend would
// 404 the same way on any nested call below, so checking against the
// already-fetched schools list here avoids firing off doomed requests
// and shows the same "school not found" state a beat faster (see
// founder-frontend-prompt.md §4).
export function FounderSchoolLayout() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const location = useLocation();
  const schoolsQuery = useFounderSchools();
  const schools = schoolsQuery.data ?? [];
  const school = schools.find((s) => s.id === schoolId);

  if (schoolsQuery.isLoading) {
    return <SkeletonRows rows={4} cols={1} />;
  }

  if (!school) {
    return (
      <EmptyState
        message="مدرسه یافت نشد"
        description="این مدرسه در فهرست مدرسه‌های شما وجود ندارد یا لینک نامعتبر است."
        action={
          <Link to="/founder/overview" className="text-sm font-medium text-action hover:underline">
            بازگشت به نمای کلی
          </Link>
        }
      />
    );
  }

  const basePath = `/founder/schools/${schoolId}`;

  return (
    <div className="fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: 'نمای کلی', to: '/founder/overview' },
            { label: school.name },
          ]}
        />
        <FounderSchoolSwitcher className="w-56" />
      </div>

      {!school.isActive && (
        <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">
          این مدرسه در حال حاضر غیرفعال است.
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line dark:border-white/10">
        {TABS.map((tab) => {
          const to = `${basePath}${tab.to}`;
          const isActive = location.pathname === to;
          return (
            <Link
              key={tab.to}
              to={to}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-action text-action'
                  : 'border-transparent text-ink/55 hover:text-ink dark:text-paper/55 dark:hover:text-paper'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
