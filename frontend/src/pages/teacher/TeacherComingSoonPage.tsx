import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';

// Shared placeholder for every teacher-portal sidebar item that isn't
// built yet (Students, Attendance, Assessments, Homework, Timetable,
// Announcements — see Sprint 2+). This sprint is scoped to auth/routing/
// layout/dashboard only, so these routes render one shared stub instead
// of six near-identical placeholder pages or a broken link.
export function TeacherComingSoonPage({ title }: { title: string }) {
  return (
    <div className="fade-in">
      <PageHeader title={title} />
      <Card>
        <EmptyState
          message="این بخش هنوز آماده نیست"
          description="این قابلیت در اسپرینت‌های بعدی اضافه خواهد شد."
        />
      </Card>
    </div>
  );
}
