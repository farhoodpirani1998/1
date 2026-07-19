// Subject detail page. Linked from Global Search's "دروس" group
// (GlobalSearch.tsx) — the first detail route for a subject. The Subject
// entity itself is intentionally tiny (just id + title — see
// backend/src/modules/student-assessments/entities/subject.entity.ts),
// so this page stays just as small rather than inventing fields the
// backend doesn't have.

import { useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumb } from '../components/Breadcrumb';
import { InfoRow } from '../components/InfoRow';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import { useSubject } from '../hooks/useSubjects';

export function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const subjectQuery = useSubject(id);
  const subject = subjectQuery.data;

  if (subjectQuery.isError) {
    return (
      <div className="fade-in">
        <Card>
          <EmptyState
            message="درس یافت نشد"
            description="ممکن است این درس حذف شده باشد یا شناسه نامعتبر باشد."
          />
        </Card>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="fade-in">
        <div className="mb-6">
          <div className="skeleton mb-2 h-3 w-24" />
          <div className="skeleton h-6 w-48" />
        </div>
        <Card>
          <SkeletonRows rows={2} cols={2} />
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: 'دروس' }, { label: subject.title }]} />}
        title={subject.title}
      />

      <Card title="مشخصات درس">
        <InfoRow label="عنوان درس" value={subject.title} />
      </Card>
    </div>
  );
}
