import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { Table, type TableColumn } from '../../components/Table';
import { toPersianDigits } from '../../lib/format';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentReportCard } from '../../hooks/useParent';
import type { ReportCardSubjectEntry, ReportCardTermSummary } from '../../types/parent.types';

// /parent/report-card — per-term subject scores + overall average for the
// selected child. Backed by GET /parent/students/:id/report-card, which
// already existed server-side (AssessmentsService.getReportCardForParent,
// ownership-checked the same way as tuition/installments/payments) but had
// no frontend consumer until now — teachers could record assessments via
// TeacherAssessmentsPage, but parents had no page that called this endpoint.

const TERM_LABELS: Record<string, string> = {
  first_term: 'ترم اول',
  second_term: 'ترم دوم',
};

function formatScore(value: number): string {
  // Scores can be fractional (e.g. 17.5); avoid a trailing ".00" for
  // whole numbers while still showing decimals when they matter.
  const rounded = Math.round(value * 100) / 100;
  return toPersianDigits(Number.isInteger(rounded) ? rounded : rounded.toFixed(2));
}

function TermCard({ term }: { term: ReportCardTermSummary }) {
  const columns: TableColumn<ReportCardSubjectEntry>[] = [
    {
      key: 'subject',
      header: 'درس',
      render: (s) => s.subjectTitle ?? '—',
    },
    {
      key: 'score',
      header: 'نمره',
      align: 'left',
      cellClassName: 'tabular font-medium',
      render: (s) => `${formatScore(s.score)} از ${toPersianDigits(s.maxScore)}`,
    },
  ];

  return (
    <Card
      title={TERM_LABELS[term.term] ?? term.term}
      action={
        term.average !== null ? (
          <span className="text-xs text-ink/50 dark:text-paper/50">
            میانگین: <span className="tabular font-medium text-ink dark:text-paper">{formatScore(term.average)}</span>
          </span>
        ) : undefined
      }
    >
      <Table
        columns={columns}
        data={term.subjects}
        rowKey={(s) => s.subjectId}
        emptyMessage="نمره‌ای برای این ترم ثبت نشده است."
      />
    </Card>
  );
}

export function ParentReportCardPage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const reportCardQuery = useStudentReportCard(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="کارنامه" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="کارنامه" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const reportCard = reportCardQuery.data;
  const terms = reportCard?.terms ?? [];

  return (
    <div className="fade-in">
      <PageHeader
        title="کارنامه"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      {reportCardQuery.isLoading ? (
        <SkeletonCards count={3} />
      ) : terms.length === 0 ? (
        <Card>
          <EmptyState
            message="هنوز نمره‌ای برای این دانش‌آموز ثبت نشده است"
            description="به‌محض ثبت نمرات توسط معلم، کارنامه در این صفحه نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="میانگین کل"
              value={reportCard?.overallAverage !== null && reportCard?.overallAverage !== undefined ? formatScore(reportCard.overallAverage) : '—'}
              accent="action"
              size="lg"
            />
            {terms.map((term) => (
              <StatCard
                key={term.term}
                label={`میانگین ${TERM_LABELS[term.term] ?? term.term}`}
                value={term.average !== null ? formatScore(term.average) : '—'}
              />
            ))}
          </div>

          <div className="mt-6 space-y-6">
            {terms.map((term) => (
              <TermCard key={term.term} term={term} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
