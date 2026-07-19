import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';
import { useTeacherAnnouncements } from '../../hooks/useTeacher';

// /teacher/announcements — read-only feed of announcements targeted at
// 'all' or 'teachers', within the caller's own school. Backed by
// GET /teacher/announcements, which already existed server-side
// (TeacherController.getMyAnnouncements, same audience-filtering shape
// as the parent portal's GET /parent/announcements) but had no frontend
// consumer — the sidebar's "اطلاعیه‌ها" item pointed at
// TeacherComingSoonPage instead.

// Mirrors backend AnnouncementTargetType (all/parents/teachers) — same
// label set as AnnouncementDetailPage.tsx (the admin-side equivalent).
const targetTypeLabels: Record<string, string> = {
  all: 'همه',
  parents: 'والدین',
  teachers: 'معلمان',
};

export function TeacherAnnouncementsPage() {
  const announcementsQuery = useTeacherAnnouncements();
  const announcements = announcementsQuery.data ?? [];

  return (
    <div className="fade-in">
      <PageHeader title="اطلاعیه‌ها" />

      {announcementsQuery.isLoading ? (
        <SkeletonCards count={3} />
      ) : announcements.length === 0 ? (
        <Card>
          <EmptyState
            message="اطلاعیه‌ای برای نمایش وجود ندارد"
            description="اطلاعیه‌های مدرسه که برای معلمان منتشر شود، در این صفحه نمایش داده می‌شود."
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
                  {targetTypeLabels[announcement.targetType] ?? announcement.targetType} · {formatDate(announcement.createdAt)}
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
