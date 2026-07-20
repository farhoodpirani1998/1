import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards } from '../../components/Skeleton';
import { Table, type TableColumn } from '../../components/Table';
import { ScoreIcon } from '../../components/icons/SchoolIcons';
import { toPersianDigits, formatScore, assessmentTermLabels } from '../../lib/format';
import { useStudentAssessments } from '../../hooks/useStudentPortal';
import type { ParentAssessmentView } from '../../types/parent.types';

// Task 5B-G — /student/assessments. The signed-in student's own recorded
// scores, backed by GET /student/assessments (useStudentAssessments) only —
// no other query, no direct API call, no duplicated state/business logic.
//
// Design reference: same read-only "stat row + records table" shape as
// StudentAttendancePage (its own closest sibling within this portal), and
// the same ParentAssessmentView rows ParentReportCardPage already renders
// for the parent side (the backend reuses that exact view for the
// student's own reads; see types/studentPortal.types.ts). There's no
// StudentSwitcher here (unlike Parent) since a student portal session is
// always exactly one student — that's the only structural difference
// from the parent equivalent.
//
// ParentAssessmentView carries subject, term, score, maxScore and note —
// it has no "assessment type" or "assessment date" field (the backend
// entity doesn't record either; see TeacherAssessmentsPage's own file
// header for the same "no control for a field the backend doesn't have"
// reasoning). Percentage isn't a stored field either, but it's a pure
// derivation of score/maxScore already on the DTO, so it's computed here
// rather than requested from the server — same "if available" guard as
// maxScore being 0 or missing would make it meaningless.
//
// Loading/empty/error states follow the Teacher Portal convention (see
// TeacherAttendancePage's studentsQuery handling): an explicit
// EmptyState + "تلاش مجدد" retry action on error, SkeletonCards while the
// stat row has no data yet, and Table's own built-in empty state for a
// genuinely empty record set.

// Percentage is only meaningful when maxScore is a positive number —
// anything else (0, negative, missing) renders as "—" rather than a
// misleading Infinity/NaN.
function formatPercentage(score: number, maxScore: number): string {
  if (!maxScore || maxScore <= 0) return '—';
  const pct = Math.round((score / maxScore) * 100);
  return `${toPersianDigits(pct)}٪`;
}

export function StudentAssessmentsPage() {
  const assessmentsQuery = useStudentAssessments();

  if (assessmentsQuery.isLoading) {
    return (
      <div className="fade-in">
        <PageHeader title="ارزیابی‌ها" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (assessmentsQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="ارزیابی‌ها" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری ارزیابی‌ها"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => assessmentsQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const records = [...(assessmentsQuery.data ?? [])].sort((a, b) => a.term.localeCompare(b.term));
  const scored = records.filter((r) => r.maxScore > 0);
  const average =
    scored.length > 0
      ? scored.reduce((sum, r) => sum + r.score / r.maxScore, 0) / scored.length
      : null;
  const firstTermCount = records.filter((r) => r.term === 'first_term').length;
  const secondTermCount = records.filter((r) => r.term === 'second_term').length;

  const columns: TableColumn<ParentAssessmentView>[] = [
    {
      key: 'subject',
      header: 'درس',
      render: (r) => r.subjectTitle ?? '—',
    },
    {
      key: 'term',
      header: 'ترم',
      render: (r) => assessmentTermLabels[r.term] ?? r.term,
    },
    {
      key: 'score',
      header: 'نمره',
      align: 'left',
      cellClassName: 'tabular font-medium',
      render: (r) => `${formatScore(r.score)} از ${toPersianDigits(r.maxScore)}`,
    },
    {
      key: 'percentage',
      header: 'درصد',
      align: 'left',
      cellClassName: 'tabular',
      render: (r) => formatPercentage(r.score, r.maxScore),
    },
    {
      key: 'note',
      header: 'یادداشت',
      render: (r) => r.note ?? '—',
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="ارزیابی‌ها" description="نمرات و ارزیابی‌های ثبت‌شده برای شما" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="میانگین کل"
          value={average !== null ? `${toPersianDigits(Math.round(average * 100))}٪` : '—'}
          accent="action"
        />
        <StatCard label="ترم اول" value={toPersianDigits(firstTermCount)} />
        <StatCard label="ترم دوم" value={toPersianDigits(secondTermCount)} />
      </div>

      <div className="mt-6">
        <Card title="سوابق ارزیابی">
          <Table
            columns={columns}
            data={records}
            rowKey={(r) => r.id}
            emptyMessage="ارزیابی‌ای برای نمایش وجود ندارد."
            emptyDescription="به‌محض ثبت نمرات توسط معلم، در این صفحه نمایش داده می‌شود."
            emptyIcon={<ScoreIcon size={28} />}
          />
        </Card>
      </div>
    </div>
  );
}
