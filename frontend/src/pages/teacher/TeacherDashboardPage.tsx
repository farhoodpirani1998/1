import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { InfoRow } from '../../components/InfoRow';
import { SectionHeader } from '../../components/SectionHeader';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards, SkeletonRows } from '../../components/Skeleton';
import {
  useTeacherProfile,
  useTeacherClasses,
  useTeacherSubjects,
  useTeacherStudents,
  useTeacherTimetable,
  useTeacherAttendanceStatus,
  useTeacherHomework,
  useTeacherHomeworkSubmissionSummaries,
  useTeacherAnnouncements,
  useMarkAnnouncementRead,
} from '../../hooks/useTeacher';
import {
  TeacherIcon,
  ClassIcon,
  SubjectIcon,
  CalendarIcon,
  StudentsIcon,
  AttendanceIcon,
  AssignmentsIcon,
  NotificationIcon,
  ScoreIcon,
  ReportsIcon,
  ChevronEnterIcon,
  TargetIcon,
  MessageIcon,
  HistoryIcon,
} from '../../components/icons/SchoolIcons';
import { toPersianDigits, formatRelativeTime } from '../../lib/format';

// Quick Actions — shortcuts to the teacher-portal pages used most often
// day-to-day. Every `to` below is an existing route already registered
// in App.tsx (no new pages/routes added). "ثبت نمره" and "مشاهده
// ارزشیابی" both point at /teacher/assessments since that single page
// already covers entering and reviewing scores — there is no separate
// read-only evaluation page to link to instead.
const QUICK_ACTIONS: {
  title: string;
  description: string;
  to: string;
  icon: typeof AttendanceIcon;
}[] = [
  {
    title: 'ثبت حضور و غیاب',
    description: 'ثبت وضعیت حضور دانش‌آموزان برای امروز',
    to: '/teacher/attendance',
    icon: AttendanceIcon,
  },
  {
    title: 'ثبت نمره',
    description: 'ثبت نمرات ارزشیابی دانش‌آموزان',
    to: '/teacher/assessments',
    icon: ScoreIcon,
  },
  {
    title: 'ارسال تکلیف',
    description: 'تعریف تکلیف جدید برای یک کلاس',
    to: '/teacher/homework',
    icon: AssignmentsIcon,
  },
  {
    title: 'ارسال اطلاعیه',
    description: 'مشاهده جدیدترین اطلاعیه‌های مدرسه',
    to: '/teacher/announcements',
    icon: NotificationIcon,
  },
  {
    title: 'مشاهده ارزشیابی',
    description: 'بررسی نمرات ثبت‌شده دانش‌آموزان',
    to: '/teacher/assessments',
    icon: ReportsIcon,
  },
];

// 'HH:MM' -> minutes since midnight, for comparing TimetableEntryView's
// startTime/endTime against the current time.
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

// --- Pending Tasks ------------------------------------------------------
// Sprint F.1: attendance and homework-review are now backed by real
// backend reads (GET /teacher/attendance/status,
// GET /teacher/homework/:id/submissions/summary — see useTeacher.ts).
// Assessment completion and parent messages remain unsupported: only
// POST /teacher/assessments exists (no read route the Dashboard can use
// for "still ungraded"), and there is no parent<->teacher messaging
// module anywhere in the backend. Both still render as clearly-marked
// "به‌زودی" placeholders rather than an invented count.

type TaskPriority = 'high' | 'medium' | 'low';

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'بالا',
  medium: 'متوسط',
  low: 'پایین',
};

const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  high: 'bg-overdue-soft text-overdue border-overdue/25',
  medium: 'bg-warning-soft text-warning border-warning/25',
  low: 'bg-paid-soft text-paid border-paid/25',
};

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`badge ${PRIORITY_BADGE_CLASS[priority]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

interface PendingTask {
  key: string;
  icon: typeof AttendanceIcon;
  title: string;
  description: string;
  /** null = not backed by real data yet (see comment above) */
  priority: TaskPriority | null;
  to?: string;
}

// TODO(backend): assessment completion needs a "still ungraded" read —
// GET /teacher/assessments (Sprint A.2) returns recorded scores, not a
// roster-aware pending count, and building one client-side would mean
// re-deriving roster-vs-recorded logic the backend already owns for
// attendance/homework (see TeacherService.getMyAttendanceStatus /
// buildRosterAwareSubmissionSummary) — out of scope for this sprint.
// Parent messages need an actual parent<->teacher messaging module,
// which does not exist anywhere in this backend. Neither gets an
// invented count — both render as "به‌زودی" placeholders.
const UNSUPPORTED_PENDING_TASKS: PendingTask[] = [
  {
    key: 'assessments',
    icon: ScoreIcon,
    title: 'تکمیل ارزشیابی',
    description: 'نیازمند افزودن مسیر خلاصه ارزشیابی ثبت‌نشده در بک‌اند',
    priority: null,
  },
  {
    key: 'parent-messages',
    icon: MessageIcon,
    title: 'پیام‌های والدین',
    description: 'قابلیت پیام‌رسانی والدین-معلم هنوز در بک‌اند وجود ندارد',
    priority: null,
  },
];

// Today's Persian weekday, matching the backend's Weekday enum already
// used by TimetableEntryView.weekday (0 = شنبه/Saturday ... 6 =
// جمعه/Friday — see teacher.api.ts) — used below to find today's
// timetable entries client-side, without any new backend endpoint.
function getPersianWeekday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  if (hour < 20) return 'عصر بخیر';
  return 'شب بخیر';
}

// Sprint 1 scope originally covered profile + assigned classes/subjects
// only. The teacher portal has since grown attendance, homework,
// timetable, and announcement endpoints (see useTeacher.ts) — this page
// now also reads from those (read-only, no new backend routes) to turn
// the summary row into real "what does my day look like" numbers instead
// of profile trivia.
export function TeacherDashboardPage() {
  const profileQuery = useTeacherProfile();
  const classesQuery = useTeacherClasses();
  const subjectsQuery = useTeacherSubjects();
  const studentsQuery = useTeacherStudents();
  const timetableQuery = useTeacherTimetable();
  const attendanceStatusQuery = useTeacherAttendanceStatus();
  const homeworkQuery = useTeacherHomework();
  const announcementsQuery = useTeacherAnnouncements();
  const markAnnouncementReadMutation = useMarkAnnouncementRead();

  const profile = profileQuery.data;
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const timetable = timetableQuery.data ?? [];
  const attendanceStatus = attendanceStatusQuery.data ?? [];
  const homework = homeworkQuery.data ?? [];
  const announcements = announcementsQuery.data ?? [];

  const now = new Date();
  const todayWeekday = getPersianWeekday(now);
  const todayClasses = timetable.filter((entry) => entry.weekday === todayWeekday);

  // "Pending" homework: due date hasn't passed yet, so students can
  // still submit it.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingAssignments = homework.filter((h) => new Date(h.dueDate) >= startOfToday);

  // Sprint F.1: real "not yet recorded" count, replacing the former
  // today's-class-count proxy. GET /teacher/attendance/status returns one
  // row per (grade, class) the teacher is assigned to, regardless of
  // whether that grade meets today — narrowed here to just the grades on
  // today's timetable (todayGradeIds), then summed, so this reads
  // "how much of today's attendance is still outstanding", not the
  // teacher's entire roster's status for the day.
  const todayGradeIds = new Set(todayClasses.map((c) => c.gradeId));
  const todayAttendanceGroups = attendanceStatus.filter((g) => todayGradeIds.has(g.gradeId));
  const notRecordedToday = todayAttendanceGroups.reduce((sum, g) => sum + g.notRecordedCount, 0);

  // Sprint F.1: real unread count, replacing the former "created within
  // the last 3 days" recency heuristic — GET /teacher/announcements now
  // returns each announcement's isRead for the calling teacher.
  const unreadAnnouncements = announcements.filter((a) => !a.isRead);

  // --- Today's Schedule ------------------------------------------------
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sortedTodayClasses = [...todayClasses].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  );
  // The earliest class that hasn't started yet — used to highlight the
  // next thing on the teacher's plate. If every class today has already
  // started (all ongoing/finished), nothing is highlighted.
  const nextUpcomingEntry = sortedTodayClasses.find(
    (entry) => getClassStatus(entry.startTime, entry.endTime, nowMinutes) === 'upcoming',
  );

  // --- Assigned Classes / Assigned Subjects card data -------------------
  // Student count per grade, derived from the full student roster —
  // there's no dedicated "students per class" endpoint, so this groups
  // the same list useTeacherStudents() already provides.
  const studentCountByGrade = new Map<string, number>();
  for (const s of students) {
    if (!s.gradeId) continue;
    studentCountByGrade.set(s.gradeId, (studentCountByGrade.get(s.gradeId) ?? 0) + 1);
  }

  // Subject titles taught in each grade, and the set of grades each
  // subject is taught in — both derived from profile.assignments (the
  // same grade+subject pairs TeacherProfileView already returns).
  const subjectTitlesByGrade = new Map<string, string[]>();
  const gradeIdsBySubject = new Map<string, Set<string>>();
  for (const a of profile?.assignments ?? []) {
    const titles = subjectTitlesByGrade.get(a.gradeId) ?? [];
    if (a.subjectTitle && !titles.includes(a.subjectTitle)) titles.push(a.subjectTitle);
    subjectTitlesByGrade.set(a.gradeId, titles);

    const gradeIds = gradeIdsBySubject.get(a.subjectId) ?? new Set<string>();
    gradeIds.add(a.gradeId);
    gradeIdsBySubject.set(a.subjectId, gradeIds);
  }

  const classCards = classes.map((c) => ({
    ...c,
    subjectLabel: subjectTitlesByGrade.get(c.id)?.join('، ') || '—',
    studentCount: studentCountByGrade.get(c.id) ?? 0,
  }));

  const subjectCards = subjects.map((s) => {
    const gradeIds = gradeIdsBySubject.get(s.id) ?? new Set<string>();
    const totalStudents = [...gradeIds].reduce((sum, gid) => sum + (studentCountByGrade.get(gid) ?? 0), 0);
    return { ...s, classCount: gradeIds.size, totalStudents };
  });

  // --- Recent Activity ---------------------------------------------------
  // Homework is still the only teacher-authored resource with a real
  // list/CRUD endpoint (POST /teacher/attendance and /teacher/assessments
  // have no corresponding list route), so it remains the timeline's event
  // source. Sprint F.1: each item is now enriched with its real
  // submission summary (GET /teacher/homework/:id/submissions/summary)
  // via useTeacherHomeworkSubmissionSummaries — batched once for exactly
  // the 5 homework ids shown here, not a query per rendered row.
  const recentActivityHomeworks = [...homework]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const recentActivitySummaries = useTeacherHomeworkSubmissionSummaries(
    recentActivityHomeworks.map((h) => h.id),
  );
  const recentActivity = recentActivityHomeworks.map((h, idx) => {
    const summary = recentActivitySummaries[idx]?.data;
    return {
      id: h.id,
      // updatedAt is set equal to createdAt on insert (see Homework
      // entity's @UpdateDateColumn), so a small tolerance distinguishes an
      // actual edit from the initial insert instead of comparing for
      // exact equality.
      action:
        new Date(h.updatedAt).getTime() - new Date(h.createdAt).getTime() > 60 * 1000
          ? 'به‌روزرسانی شد'
          : 'ثبت شد',
      title: h.title,
      subtitle: `${h.gradeTitle ?? '—'} · ${h.subjectTitle ?? '—'}`,
      at: h.updatedAt,
      submissionLabel: summary
        ? `${toPersianDigits(summary.submittedCount + summary.lateCount)}/${toPersianDigits(summary.totalStudents)} ارسال شده`
        : null,
    };
  });

  // --- Announcements widget ------------------------------------------------
  // Same GET /teacher/announcements data the summary card's
  // unreadAnnouncements count already reads — just the 5 most recent,
  // newest first. Sprint F.1: each item now carries its real isRead
  // state (unread dot), and opening one marks it read (see
  // handleAnnouncementClick below and the widget's JSX).
  const recentAnnouncements = [...announcements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // --- Pending Tasks -------------------------------------------------------
  // Sprint F.1: both attendance and homework-review are now backed by
  // real backend reads — see UNSUPPORTED_PENDING_TASKS above for why
  // assessments/parent-messages remain placeholders.
  const pendingHomeworkSummaries = useTeacherHomeworkSubmissionSummaries(
    pendingAssignments.map((h) => h.id),
  );
  // submittedCount and lateCount both mean "the student actually turned
  // it in" — summed, this is "submissions awaiting the teacher's review"
  // (there is no separate graded/reviewed flag on a submission yet, so
  // every submitted/late row counts as needing a look).
  const needsReviewCount = pendingHomeworkSummaries.reduce(
    (sum, q) => sum + (q.data ? q.data.submittedCount + q.data.lateCount : 0),
    0,
  );

  const pendingTasks: PendingTask[] = [
    {
      key: 'attendance',
      icon: AttendanceIcon,
      title: 'ثبت حضور و غیاب',
      description:
        todayClasses.length === 0
          ? 'امروز کلاسی برای ثبت حضور ندارید'
          : notRecordedToday > 0
            ? `${toPersianDigits(notRecordedToday)} کلاس امروز هنوز حضور و غیاب ثبت نشده`
            : 'حضور و غیاب همه کلاس‌های امروز ثبت شده',
      priority: todayClasses.length === 0 || notRecordedToday === 0 ? 'low' : 'high',
      to: '/teacher/attendance',
    },
    {
      key: 'homework-review',
      icon: AssignmentsIcon,
      title: 'بررسی تکالیف',
      description:
        pendingAssignments.length === 0
          ? 'تکلیف فعالی برای بررسی ندارید'
          : needsReviewCount > 0
            ? `${toPersianDigits(needsReviewCount)} ارسال دانش‌آموز در انتظار بررسی`
            : 'هنوز ارسالی برای بررسی ثبت نشده',
      priority: needsReviewCount > 0 ? 'medium' : 'low',
      to: '/teacher/homework',
    },
    ...UNSUPPORTED_PENDING_TASKS,
  ];

  // Contextual welcome-section line: a clear day beats everything else,
  // then an actionable nudge (attendance still pending) beats a plain
  // count. Only shown once the timetable AND attendance status have
  // actually loaded — while loading/erroring, the generic subtitle below
  // is used instead so this never flashes a wrong "no classes" message
  // before data arrives.
  let contextMessage: string | null = null;
  if (
    !timetableQuery.isLoading &&
    !timetableQuery.isError &&
    !attendanceStatusQuery.isLoading &&
    !attendanceStatusQuery.isError
  ) {
    if (todayClasses.length === 0) {
      contextMessage = 'امروز کلاسی ندارید.';
    } else if (notRecordedToday > 0) {
      contextMessage = `${toPersianDigits(notRecordedToday)} حضور و غیاب ثبت نشده است.`;
    } else {
      contextMessage = `امروز ${toPersianDigits(todayClasses.length)} کلاس برای شما برنامه‌ریزی شده است.`;
    }
  }

  // Sprint F.1: expand-in-place for the Announcements widget — clicking
  // an item shows its full message and marks it read (POST
  // /teacher/announcements/:id/read) if it wasn't already. Re-clicking an
  // already-expanded item just collapses it again without re-firing the
  // mutation (isRead is already true by then).
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<string | null>(null);
  function handleAnnouncementClick(a: (typeof announcements)[number]) {
    setExpandedAnnouncementId((prev) => (prev === a.id ? null : a.id));
    if (!a.isRead) {
      markAnnouncementReadMutation.mutate(a.id);
    }
  }

  // Profile is required to render anything else on the page (greeting,
  // stat cards, and info panel all read from it), so its loading/error
  // state gates the whole page. Every other query is an independent,
  // secondary panel or stat — its own loading/error/empty state is
  // handled locally below so one failing request doesn't blank out data
  // the others loaded fine.
  if (profileQuery.isLoading) {
    return (
      <div className="fade-in">
        <div className="skeleton mb-6 h-[92px] rounded-xl sm:h-20" />
        <SkeletonCards count={5} />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری اطلاعات معلم"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => profileQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const teacherName = profile?.fullName ?? '—';
  const persianDate = now.toLocaleDateString('fa-IR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fade-in">
      {/* Welcome section */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink dark:text-paper sm:text-2xl">
            {getGreeting(now.getHours())}، {teacherName}
          </h1>
          <p className="mt-1.5 text-sm text-ink/55 dark:text-paper/55">
            {contextMessage ?? 'خلاصه‌ای از وضعیت امروز کلاس‌ها و دانش‌آموزان شما'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg bg-action-soft px-4 py-2.5 text-action sm:self-auto dark:bg-action/15 dark:text-action-light">
          <CalendarIcon size={20} />
          <span className="text-sm font-medium">{persianDate}</span>
        </div>
      </div>

      {/* Summary cards — each links to the existing teacher-portal page
          the number comes from, so a card is a shortcut, not a dead end. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <Link to="/teacher/timetable" className="block rounded-xl">
          <StatCard
            label="کلاس‌های امروز"
            value={timetableQuery.isLoading ? '—' : timetableQuery.isError ? '؟' : String(todayClasses.length)}
            accent={timetableQuery.isError ? 'overdue' : 'action'}
            icon={<CalendarIcon size={22} />}
            className="transition-shadow duration-200 hover:shadow-card-hover"
          />
        </Link>
        <Link to="/teacher/students" className="block rounded-xl">
          <StatCard
            label="کل دانش‌آموزان"
            value={studentsQuery.isLoading ? '—' : studentsQuery.isError ? '؟' : String(students.length)}
            accent={studentsQuery.isError ? 'overdue' : 'default'}
            icon={<StudentsIcon size={22} />}
            className="transition-shadow duration-200 hover:shadow-card-hover"
          />
        </Link>
        <Link to="/teacher/attendance" className="block rounded-xl">
          <StatCard
            label="حضور و غیاب معلق"
            value={
              timetableQuery.isLoading || attendanceStatusQuery.isLoading
                ? '—'
                : timetableQuery.isError || attendanceStatusQuery.isError
                  ? '؟'
                  : String(notRecordedToday)
            }
            accent={timetableQuery.isError || attendanceStatusQuery.isError ? 'overdue' : 'warning'}
            icon={<AttendanceIcon size={22} />}
            className="transition-shadow duration-200 hover:shadow-card-hover"
          />
        </Link>
        <Link to="/teacher/homework" className="block rounded-xl">
          <StatCard
            label="تکالیف فعال"
            value={homeworkQuery.isLoading ? '—' : homeworkQuery.isError ? '؟' : String(pendingAssignments.length)}
            accent={homeworkQuery.isError ? 'overdue' : 'warning'}
            icon={<AssignmentsIcon size={22} />}
            className="transition-shadow duration-200 hover:shadow-card-hover"
          />
        </Link>
        <Link to="/teacher/announcements" className="block rounded-xl">
          <StatCard
            label="اعلان‌های نخوانده"
            value={
              announcementsQuery.isLoading
                ? '—'
                : announcementsQuery.isError
                  ? '؟'
                  : String(unreadAnnouncements.length)
            }
            accent={announcementsQuery.isError ? 'overdue' : 'action'}
            icon={<NotificationIcon size={22} />}
            className="transition-shadow duration-200 hover:shadow-card-hover"
          />
        </Link>
      </div>

      {/* Quick Actions */}
      <SectionHeader title="اقدامات سریع" className="mt-8" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.title}
            to={action.to}
            className="group flex flex-col items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/10 dark:bg-white/[0.03] sm:p-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-action-soft text-action transition-colors group-hover:bg-action group-hover:text-white dark:bg-action/15 dark:text-action-light">
              <action.icon size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink dark:text-paper">{action.title}</div>
              <div className="mt-1 text-xs leading-5 text-ink/50 dark:text-paper/50">{action.description}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Today's Schedule */}
      <SectionHeader title="برنامه امروز" className="mt-8" />
      <Card>
        {timetableQuery.isLoading ? (
          <SkeletonRows rows={3} cols={1} />
        ) : timetableQuery.isError ? (
          <EmptyState
            message="خطا در بارگذاری برنامه امروز"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => timetableQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : sortedTodayClasses.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={28} />}
            message="امروز کلاسی ندارید"
            description="هیچ جلسه‌ای در برنامه هفتگی شما برای امروز ثبت نشده است."
          />
        ) : (
          <ul className="divide-y divide-line dark:divide-white/10">
            {sortedTodayClasses.map((entry) => {
              const status = getClassStatus(entry.startTime, entry.endTime, nowMinutes);
              const isNext = entry.id === nextUpcomingEntry?.id;
              return (
                <li
                  key={entry.id}
                  className={`flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 ${
                    isNext ? '-mx-3 rounded-lg border border-action/30 bg-action-soft/40 px-3 dark:bg-action/10' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-paper px-2.5 py-1.5 text-center dark:bg-white/5">
                      <span className="tabular text-xs font-semibold text-ink dark:text-paper">
                        {toPersianDigits(entry.startTime)}
                      </span>
                      <span className="tabular text-[10px] text-ink/40 dark:text-paper/40">
                        {toPersianDigits(entry.endTime)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink dark:text-paper">
                        {entry.subjectTitle ?? '—'}
                        {isNext && <span className="mr-2 text-xs font-normal text-action">کلاس بعدی</span>}
                      </div>
                      <div className="truncate text-xs text-ink/50 dark:text-paper/50">
                        {entry.gradeTitle ?? '—'} ·{' '}
                        {toPersianDigits(studentCountByGrade.get(entry.gradeId) ?? 0)} دانش‌آموز
                      </div>
                    </div>
                  </div>
                  <ClassStatusBadge status={status} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Daily workflow: Pending Tasks, Notifications, Recent Activity */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionHeader
            title="کارهای در انتظار"
            action={<TargetIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {attendanceStatusQuery.isLoading || homeworkQuery.isLoading ? (
              <SkeletonRows rows={4} cols={1} />
            ) : attendanceStatusQuery.isError || homeworkQuery.isError ? (
              <EmptyState
                message="خطا در بارگذاری کارهای در انتظار"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      attendanceStatusQuery.refetch();
                      homeworkQuery.refetch();
                    }}
                  >
                    تلاش مجدد
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/10">
                {pendingTasks.map((task) => (
                  <li key={task.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        task.priority
                          ? 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light'
                          : 'bg-ink/5 text-ink/30 dark:bg-white/5 dark:text-paper/30'
                      }`}
                    >
                      <task.icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${
                            task.priority ? 'text-ink dark:text-paper' : 'text-ink/50 dark:text-paper/50'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.priority ? (
                          <PriorityBadge priority={task.priority} />
                        ) : (
                          <span className="badge border-ink/10 bg-ink/5 text-ink/40 dark:border-white/10 dark:bg-white/5 dark:text-paper/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            به‌زودی
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-ink/45 dark:text-paper/45">{task.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader
            title="اعلان‌ها"
            action={<NotificationIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {announcementsQuery.isLoading ? (
              <SkeletonRows rows={3} cols={1} />
            ) : announcementsQuery.isError ? (
              <EmptyState
                message="خطا در بارگذاری اعلان‌ها"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button variant="secondary" size="sm" onClick={() => announcementsQuery.refetch()}>
                    تلاش مجدد
                  </Button>
                }
              />
            ) : recentAnnouncements.length === 0 ? (
              <EmptyState
                icon={<NotificationIcon size={28} />}
                message="اعلانی برای نمایش وجود ندارد"
                description="اعلانیه‌های جدید مدرسه در همین‌جا نمایش داده می‌شود."
              />
            ) : (
              <>
                <ul className="divide-y divide-line dark:divide-white/10">
                  {recentAnnouncements.map((a) => {
                    const isExpanded = expandedAnnouncementId === a.id;
                    return (
                      <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => handleAnnouncementClick(a)}
                          className="flex w-full items-start justify-between gap-2 text-right"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {!a.isRead && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-action" aria-hidden="true" />
                            )}
                            <span
                              className={`truncate text-sm ${
                                a.isRead
                                  ? 'font-normal text-ink/70 dark:text-paper/70'
                                  : 'font-medium text-ink dark:text-paper'
                              }`}
                            >
                              {a.title}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-ink/40 dark:text-paper/40">
                            {formatRelativeTime(a.createdAt)}
                          </span>
                        </button>
                        {isExpanded && (
                          <p className="mt-2 whitespace-pre-line text-xs leading-6 text-ink/60 dark:text-paper/60">
                            {a.message}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Link
                  to="/teacher/announcements"
                  className="mt-3 block text-center text-xs font-medium text-action hover:underline"
                >
                  مشاهده همه اعلان‌ها
                </Link>
              </>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader
            title="فعالیت اخیر"
            action={<HistoryIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {homeworkQuery.isLoading ? (
              <SkeletonRows rows={3} cols={1} />
            ) : homeworkQuery.isError ? (
              <EmptyState
                message="خطا در بارگذاری فعالیت‌ها"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button variant="secondary" size="sm" onClick={() => homeworkQuery.refetch()}>
                    تلاش مجدد
                  </Button>
                }
              />
            ) : recentActivity.length === 0 ? (
              <EmptyState
                icon={<HistoryIcon size={28} />}
                message="هنوز فعالیتی ثبت نشده است"
                description="تکالیفی که تعریف می‌کنید در این‌جا نمایش داده می‌شود."
              />
            ) : (
              // Homework CRUD events remain the only source of this
              // timeline (POST /teacher/attendance still has no list
              // route). Sprint F.1: each row's subtitle line is now
              // enriched with its real submission count where the
              // summary has loaded (see recentActivitySummaries above) —
              // no invented figure when it hasn't.
              <ul className="space-y-4">
                {recentActivity.map((item, idx) => (
                  <li key={item.id} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-action" />
                      {idx < recentActivity.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-line dark:bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm text-ink dark:text-paper">
                        <span className="font-medium">{item.title}</span>{' '}
                        <span className="text-ink/50 dark:text-paper/50">{item.action}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink/45 dark:text-paper/45">
                        {item.subtitle} · {formatRelativeTime(item.at)}
                        {item.submissionLabel && <> · {item.submissionLabel}</>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionHeader
            title="اطلاعات معلم"
            action={<TeacherIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            <InfoRow label="نام و نام خانوادگی" value={profile?.fullName ?? '—'} />
            <InfoRow label="شماره تلفن" value={profile?.phone ?? '—'} />
            <InfoRow label="وضعیت" value={profile?.isActive ? 'فعال' : 'غیرفعال'} />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <SectionHeader
            title="کلاس‌های تخصیص‌یافته"
            action={<ClassIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          {classesQuery.isLoading ? (
            <SkeletonCards count={2} />
          ) : classesQuery.isError ? (
            <Card>
              <EmptyState
                message="خطا در بارگذاری کلاس‌ها"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button variant="secondary" size="sm" onClick={() => classesQuery.refetch()}>
                    تلاش مجدد
                  </Button>
                }
              />
            </Card>
          ) : classCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {classCards.map((c) => (
                <Card key={c.id} className="flex flex-col justify-between">
                  <div>
                    <div className="text-sm font-semibold text-ink dark:text-paper">{c.title}</div>
                    <div className="mt-1 truncate text-xs text-ink/50 dark:text-paper/50">{c.subjectLabel}</div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-ink/45 dark:text-paper/45">
                      <StudentsIcon size={15} />
                      {toPersianDigits(c.studentCount)} دانش‌آموز
                    </div>
                  </div>
                  <Link
                    to="/teacher/students"
                    className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-action-soft py-2 text-xs font-medium text-action transition-colors hover:bg-action hover:text-white dark:bg-action/15 dark:text-action-light"
                  >
                    ورود به کلاس
                    <ChevronEnterIcon size={14} />
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState message="هنوز کلاسی تخصیص داده نشده است" />
            </Card>
          )}

          <SectionHeader
            title="دروس تخصیص‌یافته"
            className="mt-6"
            action={<SubjectIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          {subjectsQuery.isLoading ? (
            <SkeletonCards count={2} />
          ) : subjectsQuery.isError ? (
            <Card>
              <EmptyState
                message="خطا در بارگذاری دروس"
                description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
                action={
                  <Button variant="secondary" size="sm" onClick={() => subjectsQuery.refetch()}>
                    تلاش مجدد
                  </Button>
                }
              />
            </Card>
          ) : subjectCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {subjectCards.map((s) => (
                <Card key={s.id}>
                  <div className="text-sm font-semibold text-ink dark:text-paper">{s.title}</div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-ink/45 dark:text-paper/45">
                    <span className="flex items-center gap-1.5">
                      <ClassIcon size={15} />
                      {toPersianDigits(s.classCount)} کلاس
                    </span>
                    <span className="flex items-center gap-1.5">
                      <StudentsIcon size={15} />
                      {toPersianDigits(s.totalStudents)} دانش‌آموز
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState message="هنوز درسی تخصیص داده نشده است" />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
