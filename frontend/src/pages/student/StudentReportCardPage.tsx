import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards } from '../../components/Skeleton';
import { Table, type TableColumn } from '../../components/Table';
import { toPersianDigits, formatScore, assessmentTermLabels } from '../../lib/format';
import { useStudentReportCard } from '../../hooks/useStudentPortal';
import type { ReportCardSubjectEntry, ReportCardTermSummary } from '../../types/parent.types';

// Task 5B-H — /student/report-card. The signed-in student's own report
// card, backed by GET /student/report-card (useStudentReportCard) only —
// no other query, no direct API call, no duplicated state/business logic.
//
// Design reference: ParentReportCardPage (/parent/report-card) is the
// closest sibling — same read-only "overall average + per-term StatCards
// + per-term subject table" shape, same ReportCardView/ReportCardTermSummary/
// ReportCardSubjectEntry rows and the same formatScore rounding rule (the
// backend reuses that exact view for the student's own read; see
// types/studentPortal.types.ts). There's no StudentSwitcher here (unlike
// Parent) since a student portal session is always exactly one student —
// that's the only structural difference from ParentReportCardPage.
//
// Loading/empty/error states follow the Teacher Portal convention (see
// TeacherAttendancePage's studentsQuery handling): an explicit
// EmptyState + "تلاش مجدد" retry action on error, SkeletonCards while the
// stat row has no data yet, and Table's own built-in empty state for a
// term with no recorded subjects.

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
      title={assessmentTermLabels[term.term] ?? term.term}
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

export function StudentReportCardPage() {
  const reportCardQuery = useStudentReportCard();

  if (reportCardQuery.isLoading) {
    return (
      <div className="fade-in">
        <PageHeader title="کارنامه" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (reportCardQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="کارنامه" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری کارنامه"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => reportCardQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const reportCard = reportCardQuery.data;
  const terms = reportCard?.terms ?? [];

  return (
    <div className="fade-in">
      <PageHeader title="کارنامه" description="نمرات و میانگین شما به تفکیک ترم" />

      {terms.length === 0 ? (
        <Card>
          <EmptyState
            message="هنوز نمره‌ای برای شما ثبت نشده است"
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
                label={`میانگین ${assessmentTermLabels[term.term] ?? term.term}`}
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
