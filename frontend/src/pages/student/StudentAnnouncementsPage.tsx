import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';
import { useStudentAnnouncements } from '../../hooks/useStudentPortal';

// Task 5B-D — /student/announcements. Read-only feed of announcements
// targeted at 'all' or 'students', within the student's own school,
// backed by GET /student/announcements (useStudentAnnouncements) only —
// no other query, no direct API call, no duplicated state/business logic.
//
// Loading/empty state and overall Card-per-announcement layout are kept
// identical to TeacherAnnouncementsPage (and its ParentAnnouncementsPage
// sibling) — same isLoading → SkeletonCards, same "no data (including an
// error, which leaves announcements as [] the same way it does there)
// falls through to one EmptyState" shape, no separate error branch,
// since that's exactly how the Teacher Portal's own version of this page
// handles it.
//
// ParentAnnouncementView (the DTO GET /student/announcements returns —
// see types/studentPortal.types.ts) carries no attachment/link field, so
// there's nothing of that kind to render here; title/publish
// date/content are all it has.
//
// Explicitly sorted newest-first: unlike StudentDashboardPage's
// recentAnnouncements (a fixed-size, pre-sorted slice the backend already
// orders for that one aggregate read), this page's full list has no such
// guarantee from GET /student/announcements alone, so the ordering is
// made explicit here — same "sort what you render, don't assume
// argument order" rule StudentAttendancePage/StudentHomeworkPage already
// apply to their own record lists.

// Same label set as AnnouncementDetailPage.tsx (the admin-side
// equivalent) and TeacherAnnouncementsPage.tsx/ParentAnnouncementsPage.tsx.
const targetTypeLabels: Record<string, string> = {
  all: 'همه',
  parents: 'والدین',
  teachers: 'معلمان',
  students: 'دانش‌آموزان',
};

export function StudentAnnouncementsPage() {
  const announcementsQuery = useStudentAnnouncements();
  const announcements = [...(announcementsQuery.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="fade-in">
      <PageHeader title="اطلاعیه‌ها" />

      {announcementsQuery.isLoading ? (
        <SkeletonCards count={3} />
      ) : announcements.length === 0 ? (
        <Card>
          <EmptyState
            message="اطلاعیه‌ای برای نمایش وجود ندارد"
            description="اطلاعیه‌های مدرسه که برای دانش‌آموزان منتشر شود، در این صفحه نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card
              key={announcement.id}
              title={announcement.title}
              action={
                <span className="text-xs text-ink/50 dark:text-paper/50">
                  {targetTypeLabels[announcement.targetType] ?? announcement.targetType} ·{' '}
                  {formatDate(announcement.createdAt)}
                </span>
              }
            >
              <p className="whitespace-pre-line text-sm leading-7 text-ink/80 dark:text-paper/80">
                {announcement.message}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
