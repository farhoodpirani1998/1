// Announcement detail page. Linked from Global Search's "اطلاعیه‌ها"
// group (GlobalSearch.tsx) — the first detail route for a single
// announcement; the admin side previously only ever listed/created/
// deleted announcements, never viewed one on its own page. Read-only:
// posting/removing announcements stays on the existing admin surface.

import { useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumb } from '../components/Breadcrumb';
import { InfoRow } from '../components/InfoRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { formatDate } from '../lib/format';
import { useAnnouncementDetail } from '../hooks/useAnnouncements';

// Mirrors backend AnnouncementTargetType (all/parents/teachers) — see
// backend/src/modules/announcements/entities/announcement.entity.ts.
// No frontend label mapping existed anywhere yet (every other consumer
// of targetType leaves it as a raw string), so this is the first one.
const targetTypeLabels: Record<string, string> = {
  all: 'همه (والدین و معلمان)',
  parents: 'والدین',
  teachers: 'معلمان',
};

export function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const announcementQuery = useAnnouncementDetail(id);
  const announcement = announcementQuery.data;

  if (announcementQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="اطلاعیه یافت نشد"
            description="ممکن است این اطلاعیه حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="fade-in">
        <div className="mb-6">
          <div className="skeleton mb-2 h-3 w-24" />
          <div className="skeleton h-6 w-48" />
        </div>
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: 'اطلاعیه‌ها' }, { label: announcement.title }]} />}
        title={announcement.title}
        description={`منتشرشده در ${formatDate(announcement.createdAt)}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="مشخصات">
          <InfoRow label="مخاطب" value={targetTypeLabels[announcement.targetType] ?? announcement.targetType} />
          <InfoRow label="تاریخ انتشار" value={formatDate(announcement.createdAt)} />
        </Card>

        <Card title="متن اطلاعیه">
          <p className="whitespace-pre-line text-sm leading-7 text-ink/80 dark:text-paper/80">
            {announcement.message}
          </p>
        </Card>
      </div>
    </div>
  );
}
