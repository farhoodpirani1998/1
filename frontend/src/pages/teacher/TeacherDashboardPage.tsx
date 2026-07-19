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
  useTeacherHomework,
  useTeacherAnnouncements,
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
// Backend reality check (see teacher.api.ts / homework.entity.ts /
// announcements.entity.ts):
// - Attendance: POST-only, no read endpoint — "not yet submitted" can only
//   be approximated by today's class count (same proxy the summary cards
//   above already use), not a true submitted/missing count.
// - Homework review, assessment completion, parent messages: there is no
//   submission-tracking table, no assessment read endpoint, and no
//   parent<->teacher messaging module anywhere in the backend at all — see
//   the TODOs inline below. These render as clearly-marked "not available
//   yet" items rather than an invented number.

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
  /** null = not backed by real data yet (see TODOs above each one below) */
  priority: TaskPriority | null;
  to?: string;
}

// TODO(backend): homework review needs a submission-tracking table (the
// Homework entity has no per-student submission concept at all today —
// see homework.entity.ts); assessment completion needs a GET read route
// (only POST /teacher/assessments exists, see teacher.api.ts); parent
// messages need an actual parent<->teacher messaging module, which does
// not exist anywhere in this backend. None of these get an invented
// count — they render as "به‌زودی" placeholders until the backend work
// above lands.
const UNSUPPORTED_PENDING_TASKS: PendingTask[] = [
  {
    key: 'homework-review',
    icon: AssignmentsIcon,
    title: 'بررسی تکالیف',
    description: 'نیازمند افزودن ردیابی ارسال تکلیف دانش‌آموزان در بک‌اند',
    priority: null,
  },
  {
    key: 'assessments',
    icon: ScoreIcon,
    title: 'تکمیل ارزشیابی',
    description: 'نیازمند افزودن مسیر خواندن نمرات ثبت‌شده در بک‌اند',
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

const RECENT_ANNOUNCEMENT_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

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
  const homeworkQuery = useTeacherHomework();
  const announcementsQuery = useTeacherAnnouncements();

  const profile = profileQuery.data;
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const timetable = timetableQuery.data ?? [];
  const homework = homeworkQuery.data ?? [];
  const announcements = announcementsQuery.data ?? [];

  const now = new Date();
  const todayWeekday = getPersianWeekday(now);
  const todayClasses = timetable.filter((entry) => entry.weekday === todayWeekday);

  // "Pending" homework: due date hasn't passed yet, so students can
  // still submit it — the closest read-only proxy for "active
  // assignments" without a submissions-tracking endpoint.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingAssignments = homework.filter((h) => new Date(h.dueDate) >= startOfToday);

  // There's no attendance-history read endpoint yet (POST-only, see
  // teacher.api.ts), so there's no way to know which of today's classes
  // already had attendance recorded. Today's class count is used as the
  // best available stand-in for "attendance that may still be pending".
  const pendingAttendanceCount = todayClasses.length;

  // No read/unread tracking on announcements either — recency is the
  // best available signal for "new".
  const newAnnouncements = announcements.filter(
    (a) => now.getTime() - new Date(a.createdAt).getTime() <= RECENT_ANNOUNCEMENT_MS,
  );

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
  // Homework is the only teacher-authored resource with a real GET
  // endpoint (POST /teacher/attendance and /teacher/assessments have no
  // corresponding list route — see teacher.api.ts), so it's the only
  // source this timeline can honestly build from today. TODO: once
  // GET /teacher/attendance and GET /teacher/assessments (read) exist,
  // merge those events in here instead of homework being the only source.
  const recentActivity = [...homework]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((h) => ({
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
    }));

  // --- Notifications widget ----------------------------------------------
  // Same GET /teacher/announcements data the summary card's
  // newAnnouncements count already reads — just the 5 most recent, newest
  // first. TODO: no per-user read/unread column exists on the
  // announcements table yet, so no unread indicator is rendered (spec:
  // "only if supported by the backend").
  const recentAnnouncements = [...announcements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Attendance is the one Pending Task item backed by real (if
  // approximate) data — see the TODO block above UNSUPPORTED_PENDING_TASKS
  // for why the other three are placeholders instead.
  const pendingTasks: PendingTask[] = [
    {
      key: 'attendance',
      icon: AttendanceIcon,
      title: 'ثبت حضور و غیاب',
      description:
        pendingAttendanceCount > 0
          ? `${toPersianDigits(pendingAttendanceCount)} کلاس امروز هنوز حضور و غیاب ثبت نشده`
          : 'امروز کلاسی برای ثبت حضور ندارید',
      priority: pendingAttendanceCount > 0 ? 'high' : 'low',
      to: '/teacher/attendance',
    },
    ...UNSUPPORTED_PENDING_TASKS,
  ];

  // Contextual welcome-section line: a clear day beats everything else,
  // then an actionable nudge (attendance still pending) beats a plain
  // count. Only shown once the timetable has actually loaded — while
  // loading/erroring, the generic subtitle below is used instead so this
  // never flashes a wrong "no classes" message before data arrives.
  let contextMessage: string | null = null;
  if (!timetableQuery.isLoading && !timetableQuery.isError) {
    if (todayClasses.length === 0) {
      contextMessage = 'امروز کلاسی ندارید.';
    } else if (pendingAttendanceCount > 0) {
      contextMessage = `${toPersianDigits(pendingAttendanceCount)} حضور و غیاب ثبت نشده است.`;
    } else {
      contextMessage = `امروز ${toPersianDigits(todayClasses.length)} کلاس برای شما برنامه‌ریزی شده است.`;
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
            value={timetableQuery.isLoading ? '—' : timetableQuery.isError ? '؟' : String(pendingAttendanceCount)}
            accent={timetableQuery.isError ? 'overdue' : 'warning'}
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
            label="اعلان‌های جدید"
            value={
              announcementsQuery.isLoading ? '—' : announcementsQuery.isError ? '؟' : String(newAnnouncements.length)
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
                  {recentAnnouncements.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink dark:text-paper">{a.title}</span>
                        <span className="shrink-0 text-xs text-ink/40 dark:text-paper/40">
                          {formatRelativeTime(a.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                {/* TODO(backend): no per-user read/unread column exists on
                    announcements yet, so no unread dot/count is shown here. */}
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
              // TODO(backend): once GET /teacher/attendance and a read
              // endpoint for /teacher/assessments exist, merge those
              // events into this timeline alongside homework.
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
