import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';
import { useMyAnnouncements } from '../../hooks/useParent';

// /parent/announcements — read-only feed of announcements targeted at
// 'all' or 'parents', within the caller's own school. Backed by
// GET /parent/announcements, which already existed server-side
// (ParentController.getMyAnnouncements) and even had a frontend API
// function (getMyAnnouncements) written for it — but no page or hook
// ever called it, and no sidebar link pointed here.

// Same label set as AnnouncementDetailPage.tsx (the admin-side equivalent)
// and TeacherAnnouncementsPage.tsx.
const targetTypeLabels: Record<string, string> = {
  all: 'همه',
  parents: 'والدین',
  teachers: 'معلمان',
};

export function ParentAnnouncementsPage() {
  const announcementsQuery = useMyAnnouncements();
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
            description="اطلاعیه‌های مدرسه که برای والدین منتشر شود، در این صفحه نمایش داده می‌شود."
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
