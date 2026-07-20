import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { InfoRow } from '../../components/InfoRow';
import { SectionHeader } from '../../components/SectionHeader';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { SkeletonCards } from '../../components/Skeleton';
import { useStudentDashboard } from '../../hooks/useStudentPortal';
import {
  StudentIcon,
  CalendarIcon,
  AssignmentsIcon,
  AttendanceIcon,
  NotificationIcon,
  ScoreIcon,
  ReportsIcon,
} from '../../components/icons/SchoolIcons';
import { toPersianDigits, formatDate, formatRelativeTime, formatScore, assessmentTermLabels } from '../../lib/format';
import type { StudentStatus } from '../../types/student.types';
import type { AttendanceStatus } from '../../types/parent.types';

// Task 5B-A. Same page shape as TeacherDashboardPage — welcome banner,
// summary StatCard row, a "today" schedule Card, then two 3-column rows
// of secondary Cards — just built from the *one* aggregate read
// GET /student/dashboard (useStudentDashboard) instead of the several
// independent per-resource queries the Teacher Dashboard composes. Quick
// Actions are intentionally omitted (per Task 5B-A) — every one of
// Teacher's summary cards/quick actions links to an already-registered
// /teacher/* route, and no /student/* route besides /student/login is
// registered yet (Task 5A scope), so nothing here is wrapped in a <Link>.

// --- Today's schedule status --------------------------------------------
// Same pure "is this class upcoming/ongoing/finished" derivation as
// TeacherDashboardPage's own local helpers of the same name — kept
// page-local here too rather than extracted to a shared module, matching
// this codebase's existing convention of each dashboard/page owning its
// own small presentation-only status maps (see e.g. StudentsPage's and
// ParentAttendancePage's own local status-label consts, both independently
// defined rather than shared).
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

// Today's Persian weekday — same derivation TeacherDashboardPage already
// uses against the same Weekday enum (0 = شنبه ... 6 = جمعه).
function getPersianWeekday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  if (hour < 20) return 'عصر بخیر';
  return 'شب بخیر';
}

// --- Attendance status --------------------------------------------------
// Same labels/colors as ParentAttendancePage's own local consts (that page
// defines these independently too, rather than sharing them) — kept
// visually identical so "غایب"/"تأخیر"/etc. read the same way in every
// portal that shows attendance.
const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غایب',
  late: 'تأخیر',
  excused: 'موجه',
};

const ATTENDANCE_STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
  present: 'bg-paid/10 text-paid border-paid/25',
  absent: 'bg-overdue/10 text-overdue border-overdue/25',
  late: 'bg-action-soft text-action border-action/25',
  excused: 'bg-ink/5 text-ink/60 border-line dark:bg-white/5 dark:text-paper/60 dark:border-white/10',
};

function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`badge ${ATTENDANCE_STATUS_BADGE_CLASS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ATTENDANCE_STATUS_LABEL[status]}
    </span>
  );
}

// --- Student status -------------------------------------------------------
// Same labels/colors as StudentsPage's own local consts.
const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};


export function StudentDashboardPage() {
  const dashboardQuery = useStudentDashboard();
  const dashboard = dashboardQuery.data;

  if (dashboardQuery.isLoading) {
    return (
      <div className="fade-in">
        <div className="skeleton mb-6 h-[92px] rounded-xl sm:h-20" />
        <SkeletonCards count={5} />
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <div className="fade-in">
        <PageHeader title="داشبورد" />
        <Card>
          <EmptyState
            message="خطا در بارگذاری داشبورد"
            description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            action={
              <Button variant="secondary" size="sm" onClick={() => dashboardQuery.refetch()}>
                تلاش مجدد
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const profile = dashboard?.profile;
  const timetable = dashboard?.timetable ?? [];
  const homework = dashboard?.homework ?? [];
  const recentAnnouncements = dashboard?.recentAnnouncements ?? [];
  const recentAttendance = dashboard?.recentAttendance ?? [];
  const recentAssessments = dashboard?.recentAssessments ?? [];
  const reportCard = dashboard?.reportCard;

  const now = new Date();
  const todayWeekday = getPersianWeekday(now);
  const todayClasses = timetable.filter((entry) => entry.weekday === todayWeekday);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sortedTodayClasses = [...todayClasses].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  );
  const nextUpcomingEntry = sortedTodayClasses.find(
    (entry) => getClassStatus(entry.startTime, entry.endTime, nowMinutes) === 'upcoming',
  );

  // "Pending" homework: not yet submitted and the due date hasn't passed
  // yet — same "due date hasn't passed" rule TeacherDashboardPage applies
  // to its own pendingAssignments, plus the one extra condition a student's
  // own view actually carries (submissionStatus) that a teacher's authored
  // list doesn't.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingHomework = homework
    .filter((h) => h.submissionStatus === null && new Date(h.dueDate) >= startOfToday)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // recentAnnouncements/recentAttendance/recentAssessments arrive from the
  // backend already sorted newest-first and limited to a fixed count (see
  // StudentService.getMyDashboard) — rendered as-is, not re-sorted or
  // re-sliced here, so this page doesn't re-derive an ordering decision
  // the backend already owns.
  const recentAbsenceCount = recentAttendance.filter((a) => a.status === 'absent').length;

  const studentName = profile?.fullName ?? '—';
  const persianDate = now.toLocaleDateString('fa-IR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Same "clear day beats an actionable nudge beats a plain count"
  // priority TeacherDashboardPage's own contextMessage uses, adapted to
  // what actually matters to a student (pending homework rather than
  // pending attendance-taking).
  let contextMessage: string;
  if (todayClasses.length === 0) {
    contextMessage = 'امروز کلاسی ندارید.';
  } else if (pendingHomework.length > 0) {
    contextMessage = `${toPersianDigits(pendingHomework.length)} تکلیف در انتظار ارسال دارید.`;
  } else {
    contextMessage = `امروز ${toPersianDigits(todayClasses.length)} کلاس برای شما برنامه‌ریزی شده است.`;
  }

  // Same expand-in-place pattern as TeacherDashboardPage's announcements
  // widget, minus the mark-as-read mutation — /student/announcements has
  // no isRead field to toggle (unlike GET /teacher/announcements), so
  // there is nothing to write back; this is a purely client-side toggle,
  // not an extra request.
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<string | null>(null);

  return (
    <div className="fade-in">
      {/* Welcome header */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink dark:text-paper sm:text-2xl">
            {getGreeting(now.getHours())}، {studentName}
          </h1>
          <p className="mt-1.5 text-sm text-ink/55 dark:text-paper/55">{contextMessage}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg bg-action-soft px-4 py-2.5 text-action sm:self-auto dark:bg-action/15 dark:text-action-light">
          <CalendarIcon size={20} />
          <span className="text-sm font-medium">{persianDate}</span>
        </div>
      </div>

      {/* Statistics cards — plain, not links: unlike Teacher's summary
          row, none of the /student/* pages these numbers relate to are
          registered yet (Task 5A scope), so there is nowhere to send a
          click. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="کلاس‌های امروز" value={String(todayClasses.length)} accent="action" icon={<CalendarIcon size={22} />} />
        <StatCard
          label="تکالیف در انتظار ارسال"
          value={String(pendingHomework.length)}
          accent="warning"
          icon={<AssignmentsIcon size={22} />}
        />
        <StatCard
          label="غیبت‌های اخیر"
          value={String(recentAbsenceCount)}
          accent={recentAbsenceCount > 0 ? 'overdue' : 'default'}
          icon={<AttendanceIcon size={22} />}
        />
        <StatCard
          label="اعلانیه‌های اخیر"
          value={String(recentAnnouncements.length)}
          accent="action"
          icon={<NotificationIcon size={22} />}
        />
        <StatCard
          label="میانگین کارنامه"
          value={reportCard && reportCard.overallAverage !== null ? formatScore(reportCard.overallAverage) : '—'}
          accent="default"
          icon={<ReportsIcon size={22} />}
        />
      </div>

      {/* Today's timetable */}
      <SectionHeader title="برنامه امروز" className="mt-8" />
      <Card>
        {sortedTodayClasses.length === 0 ? (
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
                        {entry.teacherName ?? '—'}
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

      {/* Pending homework, Recent announcements, Recent attendance */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionHeader
            title="تکالیف در انتظار ارسال"
            action={<AssignmentsIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {pendingHomework.length === 0 ? (
              <EmptyState
                icon={<AssignmentsIcon size={28} />}
                message="تکلیف در انتظار ارسال ندارید"
                description="تکالیفی که هنوز ارسال نکرده‌اید در این‌جا نمایش داده می‌شود."
              />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/10">
                {pendingHomework.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-action-soft text-action dark:bg-action/15 dark:text-action-light">
                        <AssignmentsIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink dark:text-paper">{h.title}</div>
                        <div className="truncate text-xs text-ink/50 dark:text-paper/50">
                          {h.subjectTitle ?? '—'}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-ink/45 dark:text-paper/45">
                      موعد: {formatDate(h.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader
            title="اطلاعیه‌های اخیر"
            action={<NotificationIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {recentAnnouncements.length === 0 ? (
              <EmptyState
                icon={<NotificationIcon size={28} />}
                message="اعلانیه‌ای برای نمایش وجود ندارد"
                description="اعلانیه‌های جدید مدرسه در همین‌جا نمایش داده می‌شود."
              />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/10">
                {recentAnnouncements.map((a) => {
                  const isExpanded = expandedAnnouncementId === a.id;
                  return (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setExpandedAnnouncementId((prev) => (prev === a.id ? null : a.id))}
                        className="flex w-full items-start justify-between gap-2 text-right"
                      >
                        <span className="truncate text-sm font-medium text-ink dark:text-paper">{a.title}</span>
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
            )}
          </Card>
        </div>

        <div>
          <SectionHeader
            title="حضور و غیاب اخیر"
            action={<AttendanceIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {recentAttendance.length === 0 ? (
              <EmptyState
                icon={<AttendanceIcon size={28} />}
                message="سابقه‌ای برای نمایش وجود ندارد"
              />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/10">
                {recentAttendance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-sm text-ink dark:text-paper">{formatDate(a.date)}</div>
                      {a.note && (
                        <div className="truncate text-xs text-ink/45 dark:text-paper/45">{a.note}</div>
                      )}
                    </div>
                    <AttendanceStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Recent assessments, Report card summary, Student information */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionHeader
            title="ارزیابی‌های اخیر"
            action={<ScoreIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            {recentAssessments.length === 0 ? (
              <EmptyState icon={<ScoreIcon size={28} />} message="نمره‌ای ثبت نشده است" />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/10">
                {recentAssessments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink dark:text-paper">
                        {a.subjectTitle ?? '—'}
                      </div>
                      <div className="text-xs text-ink/50 dark:text-paper/50">{assessmentTermLabels[a.term] ?? a.term}</div>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium text-ink dark:text-paper">
                      {formatScore(a.score)} از {toPersianDigits(a.maxScore)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader
            title="خلاصه کارنامه"
            action={<ReportsIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/60 dark:text-paper/60">میانگین کل</span>
              <span className="tabular text-xl font-bold text-ink dark:text-paper">
                {reportCard && reportCard.overallAverage !== null ? formatScore(reportCard.overallAverage) : '—'}
              </span>
            </div>
            {reportCard && reportCard.terms.length > 0 ? (
              <div className="mt-3 divide-y divide-line dark:divide-white/10">
                {reportCard.terms.map((t) => (
                  <InfoRow
                    key={t.term}
                    label={assessmentTermLabels[t.term] ?? t.term}
                    value={t.average !== null ? formatScore(t.average) : '—'}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink/45 dark:text-paper/45">هنوز نمره‌ای برای کارنامه ثبت نشده است.</p>
            )}
          </Card>
        </div>

        <div>
          <SectionHeader
            title="اطلاعات دانش‌آموز"
            action={<StudentIcon size={18} className="text-ink/30 dark:text-paper/30" />}
          />
          <Card>
            <InfoRow label="نام و نام خانوادگی" value={profile?.fullName ?? '—'} />
            <InfoRow label="کد ملی" value={profile?.nationalId ?? '—'} />
            <InfoRow label="وضعیت" value={profile ? STUDENT_STATUS_LABEL[profile.status] : '—'} />
            <InfoRow
              label="تاریخ ثبت‌نام"
              value={profile?.enrollmentDate ? formatDate(profile.enrollmentDate) : '—'}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
