import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonRows } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { formatDate } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentDocuments } from '../../hooks/useParent';
import { studentDocumentTypeLabels, type StudentDocumentType } from '../../types/studentDocument.types';

// /parent/documents — uploaded document references (identity,
// registration, contract, medical, other) for the selected child. Backed
// by GET /parent/students/:id/documents, which already existed
// server-side (StudentDocumentsService.findForParent, ownership-checked
// the same way as tuition/installments/payments) but had no frontend
// consumer until now. Read-only — uploading stays on the school_admin
// side (StudentDetailPage), same as every other parent-portal page here.

export function ParentDocumentsPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const documentsQuery = useStudentDocuments(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="مدارک" />
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="مدارک" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const documents = documentsQuery.data ?? [];

  return (
    <div className="fade-in">
      <PageHeader
        title="مدارک"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      <Card title="مدارک بارگذاری‌شده">
        {documentsQuery.isLoading ? (
          <SkeletonRows rows={3} cols={2} />
        ) : documents.length === 0 ? (
          <EmptyState message="هیچ مدرکی برای این دانش‌آموز بارگذاری نشده است." />
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
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-action hover:underline">
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
