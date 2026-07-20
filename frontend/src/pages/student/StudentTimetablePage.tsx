import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCards } from '../../components/Skeleton';
import { toPersianDigits } from '../../lib/format';
import { useStudentTimetable } from '../../hooks/useStudentPortal';
import type { ParentTimetableEntryView } from '../../types/parent.types';

// Task 5B-F — /student/timetable. The signed-in student's own weekly
// class schedule, backed by GET /student/timetable (useStudentTimetable)
// only — no other query, no direct API call, no duplicated state.
//
// Design reference: ParentTimetablePage (/parent/timetable) is the
// closest sibling — same weekday-grouped grid of Cards, same weekday
// order/labels (0 = شنبه ... 6 = جمعه, matching the backend Weekday enum
// TeacherTimetablePage also follows), same loading/empty states, and the
// same "group + sort client-side, page-local pure function rather than a
// shared module" approach that page already takes — this page's own
// groupByWeekday below is a page-local copy of that exact logic, matching
// this codebase's documented convention (see StudentDashboardPage's own
// header comment) of each page owning its small presentation-only
// derivations rather than sharing them.
//
// Today's-classes highlighting reuses the exact same visual language
// StudentDashboardPage already established for its own "برنامه امروز"
// section: parseTimeToMinutes/getClassStatus/ClassStatusBadge and the
// action-accent "next class" tile treatment are page-local copies of
// those same helpers (not exported anywhere to import from) for the
// same "kept page-local, matching the codebase's convention" reason
// above.

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

// Same weekday derivation StudentDashboardPage/TeacherDashboardPage use
// against the backend's own Weekday enum.
function getPersianWeekday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

type ClassStatus = 'upcoming' | 'ongoing' | 'finished';

function getClassStatus(startTime: string, endTime: string, nowMinutes: number): ClassStatus {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (nowMinutes < start) return 'upcoming';
  if (nowMinutes <= end) return 'ongoing';
  return 'finished';
}

const CLASS_STATUS_LABEL: Record<ClassStatus, string> = {
  upcoming: 'پیش‌رو',
  ongoing: 'در حال برگزاری',
  finished: 'پایان‌یافته',
};

const CLASS_STATUS_BADGE_CLASS: Record<ClassStatus, string> = {
  upcoming: 'bg-action-soft text-action border-action/25',
  ongoing: 'bg-paid-soft text-paid border-paid/25',
  finished: 'bg-ink/5 text-ink/45 border-ink/10 dark:bg-white/5 dark:text-paper/45 dark:border-white/10',
};

function ClassStatusBadge({ status }: { status: ClassStatus }) {
  return (
    <span className={`badge ${CLASS_STATUS_BADGE_CLASS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {CLASS_STATUS_LABEL[status]}
    </span>
  );
}

export function StudentTimetablePage() {
  const timetableQuery = useStudentTimetable();
  const entries = timetableQuery.data ?? [];
  const grouped = groupByWeekday(entries);

  const now = new Date();
  const todayWeekday = getPersianWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="fade-in">
      <PageHeader title="برنامه هفتگی" description="برنامه کلاس‌های هفتگی شما" />

      {timetableQuery.isLoading ? (
        <SkeletonCards count={3} />
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
            const isToday = weekday === todayWeekday;
            return (
              <Card
                key={weekday}
                title={label}
                action={
                  isToday ? (
                    <span className="badge bg-action-soft text-action border-action/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      امروز
                    </span>
                  ) : undefined
                }
                className={isToday ? 'border-action/30 bg-action-soft/20 dark:bg-action/10' : ''}
              >
                <ul className="space-y-3">
                  {dayEntries.map((entry) => {
                    const status = isToday ? getClassStatus(entry.startTime, entry.endTime, nowMinutes) : null;
                    return (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-line bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-ink dark:text-paper">
                            {entry.subjectTitle ?? entry.subjectId}
                          </span>
                          <span className="tabular shrink-0 text-xs text-ink/55 dark:text-paper/55">
                            {toPersianDigits(entry.startTime)} – {toPersianDigits(entry.endTime)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50 dark:text-paper/50">
                            {entry.teacherName && <span>{entry.teacherName}</span>}
                            {entry.room && <span>کلاس: {entry.room}</span>}
                          </div>
                          {status && <ClassStatusBadge status={status} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
