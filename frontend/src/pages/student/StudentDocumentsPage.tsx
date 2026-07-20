import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonRows } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';
import { useStudentDocuments } from '../../hooks/useStudentPortal';
import { studentDocumentTypeLabels, type StudentDocumentType } from '../../types/studentDocument.types';

// Task 5B-E — /student/documents. The signed-in student's own uploaded
// document references (identity, registration, contract, medical,
// other), backed by GET /student/documents (useStudentDocuments) only —
// no other query, no direct API call, no duplicated state/business
// logic.
//
// Design reference: ParentDocumentsPage (/parent/documents) is the
// closest sibling — there's no Teacher Portal documents page to mirror
// (uploading stays school_admin-side; no portal exposes a read-only
// documents list except Parent/Student), so this follows that page's
// exact shape: SkeletonRows while loading, one EmptyState for a genuinely
// empty list, no separate error branch — same "no data (including an
// error, which leaves documents as [] the same way it does there) falls
// through to the empty state" convention already established by this
// portal's own StudentAnnouncementsPage.
//
// Reuses studentDocumentTypeLabels (types/studentDocument.types.ts)
// rather than redeclaring a label map — the exact same map
// ParentDocumentsPage already uses for this same "type/category" field.
// GET /student/documents returns ParentStudentDocumentView (see
// types/studentPortal.types.ts / api/student.api.ts's getDocuments) —
// title, documentType, fileUrl, description, createdAt; no status field
// exists on that DTO, so none is shown. fileUrl is rendered as a link,
// same pattern StudentHomeworkPage/ParentDocumentsPage already use for
// their own file links.

export function StudentDocumentsPage() {
  const documentsQuery = useStudentDocuments();
  const documents = documentsQuery.data ?? [];

  return (
    <div className="fade-in">
      <PageHeader title="مدارک" />

      <Card title="مدارک بارگذاری‌شده">
        {documentsQuery.isLoading ? (
          <SkeletonRows rows={3} cols={2} />
        ) : documents.length === 0 ? (
          <EmptyState message="هیچ مدرکی برای شما بارگذاری نشده است." />
        ) : (
          <div className="divide-y divide-line dark:divide-white/10">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-ink dark:text-paper">{doc.title}</div>
                  <div className="text-xs text-ink/60 dark:text-paper/60">
                    {studentDocumentTypeLabels[doc.documentType as StudentDocumentType] ?? doc.documentType} ·{' '}
                    {formatDate(doc.createdAt)}
                    {doc.description ? ` · ${doc.description}` : ''}
                  </div>
                </div>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-action hover:underline"
                >
                  مشاهده
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
