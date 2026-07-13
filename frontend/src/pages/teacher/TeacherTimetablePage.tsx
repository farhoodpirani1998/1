// Teacher Timetable (Phase 5K, frontend).
//
// Backend is frozen for this feature: GET /teacher/timetable already
// exists on TeacherController (see
// backend/src/modules/teacher/teacher.controller.ts and
// timetable.service.ts). Read-only: no create/edit/delete surface here —
// timetable entries are managed on the school_admin side (out of scope
// for this feature, and there is no admin-facing UI for it yet either).
//
// weekday follows the backend's Weekday enum (0 = Saturday ... 6 = Friday,
// see timetable/entities/timetable-entry.entity.ts) — the Iranian school
// week. Entries are grouped by weekday client-side (the backend returns a
// flat list, unsorted by day) and each day's entries are sorted by
// startTime.

import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';
import { useTeacherTimetable } from '../../hooks/useTeacher';
import type { TimetableEntryView } from '../../api/teacher.api';

const WEEKDAY_LABELS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function groupByWeekday(entries: TimetableEntryView[]): Map<number, TimetableEntryView[]> {
  const groups = new Map<number, TimetableEntryView[]>();
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

export function TeacherTimetablePage() {
  const timetableQuery = useTeacherTimetable();
  const entries = timetableQuery.data ?? [];
  const grouped = groupByWeekday(entries);

  return (
    <div className="fade-in">
      <PageHeader title="برنامه هفتگی" description="برنامه کلاس‌های هفتگی شما" />

      {timetableQuery.isLoading ? (
        <Card>
          <SkeletonTable rows={5} cols={4} />
        </Card>
      ) : timetableQuery.isError ? (
        <Card>
          <EmptyState
            message="خطا در بارگذاری برنامه هفتگی"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => timetableQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            message="برنامه‌ای برای شما ثبت نشده است."
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
                    <li
                      key={entry.id}
                      className="rounded-lg border border-line px-3 py-2.5 dark:border-white/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink dark:text-paper">
                          {entry.subjectTitle ?? entry.subjectId}
                        </span>
                        <span className="shrink-0 text-xs text-ink/55 dark:text-paper/55">
                          {entry.startTime} – {entry.endTime}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50 dark:text-paper/50">
                        <span>{entry.gradeTitle ?? entry.gradeId}</span>
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
