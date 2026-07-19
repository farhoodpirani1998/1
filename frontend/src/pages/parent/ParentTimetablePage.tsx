import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { useParentStudent } from '../../lib/parentStudent';
import { useStudentTimetable } from '../../hooks/useParent';
import type { ParentTimetableEntryView } from '../../types/parent.types';

// /parent/timetable — the selected child's weekly class schedule. Backed
// by GET /parent/students/:id/timetable, which already existed
// server-side (TimetableService.findForParent, ownership-checked the
// same way as tuition/installments/payments) but had no frontend
// consumer until now. Same weekday-grouping display as
// TeacherTimetablePage — weekday follows the backend's Weekday enum
// (0 = Saturday ... 6 = Friday), entries grouped client-side and sorted
// by startTime within each day.

const WEEKDAY_LABELS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function groupByWeekday(entries: ParentTimetableEntryView[]): Map<number, ParentTimetableEntryView[]> {
  const groups = new Map<number, ParentTimetableEntryView[]>();
  for (const entry of entries) {
    const list = groups.get(entry.weekday) ?? [];
    list.push(entry);
    groups.set(entry.weekday, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return groups;
}

export function ParentTimetablePage() {
  const { students, selectedStudent, isLoading: studentsLoading } = useParentStudent();
  const timetableQuery = useStudentTimetable(selectedStudent?.id);

  if (studentsLoading || !selectedStudent) {
    return (
      <div className="fade-in">
        <PageHeader title="برنامه هفتگی" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader title="برنامه هفتگی" />
        <Card>
          <EmptyState
            message="هیچ دانش‌آموزی به این حساب متصل نیست"
            description="برای اتصال فرزند خود به این حساب، با مدرسه تماس بگیرید."
          />
        </Card>
      </div>
    );
  }

  const entries = timetableQuery.data ?? [];
  const grouped = groupByWeekday(entries);

  return (
    <div className="fade-in">
      <PageHeader
        title="برنامه هفتگی"
        description={`${selectedStudent.fullName} — ${selectedStudent.school.name}`}
        actions={<StudentSwitcher className="w-56" />}
      />

      {timetableQuery.isLoading ? (
        <SkeletonCards count={3} />
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            message="برنامه‌ای برای این دانش‌آموز ثبت نشده است."
            description="برنامه هفتگی توسط مدیر مدرسه تنظیم می‌شود."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {WEEKDAY_LABELS.map((label, weekday) => {
            const dayEntries = grouped.get(weekday);
            if (!dayEntries || dayEntries.length === 0) return null;
            return (
              <Card key={weekday} title={label}>
                <ul className="space-y-3">
                  {dayEntries.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-line px-3 py-2.5 dark:border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink dark:text-paper">
                          {entry.subjectTitle ?? entry.subjectId}
                        </span>
                        <span className="shrink-0 text-xs text-ink/55 dark:text-paper/55">
                          {entry.startTime} – {entry.endTime}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50 dark:text-paper/50">
                        {entry.teacherName && <span>{entry.teacherName}</span>}
                        {entry.room && <span>کلاس: {entry.room}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
