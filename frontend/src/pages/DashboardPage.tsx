import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard, type StatAccent } from '../components/StatCard';
import { KPICard } from '../components/KPICard';
import { Table, type TableColumn } from '../components/Table';
import { SkeletonCards, SkeletonRows } from '../components/Skeleton';
import {
  TuitionIcon,
  CheckIcon,
  AlertIcon,
  ListIcon,
  UsersIcon,
  TargetIcon,
  AttendanceIcon,
  AssignmentsIcon,
  CalendarIcon,
  TeacherIcon,
  StudentIcon,
  NotificationIcon,
  ScoreIcon,
  ClassIcon,
  ReportsIcon,
  LockIcon,
} from '../components/icons/SchoolIcons';
import { formatToman, formatDate, formatRelativeTime, toPersianDigits, paymentMethodLabels } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useOverdueSummary, useDebtorStudents, useMonthlyIncome, useMonthlyIncomeTrend } from '../hooks/useReports';
import { useStudents } from '../hooks/useStudents';
import { usePayments } from '../hooks/usePayments';
import { useDashboard } from '../hooks/useAnalytics';
import type { DebtorStudent } from '../types/report.types';
import type { PaymentWithContext } from '../types/payment.types';
import type { DashboardStudentAverage } from '../types/analytics.types';

// Persian calendar month names for x-axis labels — same list ReportsPage's
// IncomeTrendPanel already defines locally; kept as its own local copy
// here rather than a shared constant, matching this codebase's existing
// convention of small per-page duplication over new shared abstractions
// (see StatCard's own doc comment for the same rationale).
const persianMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

// There is no single backend endpoint for "total tuition / paid /
// remaining across the whole school" — it's derived here from what IS
// available: summing DebtorStudent.outstandingBalance (remaining) and
// the current month's MonthlyIncome (paid this month). This is an
// approximation for the home page; the exact per-student figures still
// live on each student's own statement page.
//
// NOTE: /reports/overdue-summary, /reports/monthly-income and
// /reports/debtor-students are all @Roles('school_admin', 'accountant')
// on the backend — a `staff` user would get 403 on every one of these.
// Staff still land on this page (see Sidebar), so they get a simpler
// view below instead of three failed requests.
export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'staff') {
    return <StaffDashboard />;
  }
  // school_admin gets the analytics-backed dashboard (GET
  // /analytics/dashboard, @Roles('school_admin') only on the backend).
  // accountant keeps FinancialDashboard exactly as before — the analytics
  // endpoint would 403 for that role.
  if (user?.role === 'school_admin') {
    return <SchoolAdminDashboard />;
  }
  return <FinancialDashboard />;
}

// Staff can't hit any /reports/* endpoint (school_admin/accountant only —
// see the note on DashboardPage above), so nothing here is a financial
// number. Everything below is derived client-side from GET /students,
// which staff IS allowed to call (@Roles('school_admin','accountant',
// 'staff') on StudentsController#findWithFilters) — same list StudentsPage
// already fetches, just summarized differently. No new endpoint.
function StaffDashboard() {
  const studentsQuery = useStudents();
  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isLoading;

  const today = new Date();
  const isSameDay = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };
  const isSameMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  };

  const activeCount = students.filter((s) => s.status === 'active').length;
  // enrollmentDate is the only real signal for "registered today/this
  // month" (see student.types.ts) — students without it are simply
  // excluded, not counted as 0.
  const registeredToday = students.filter((s) => s.enrollmentDate && isSameDay(s.enrollmentDate)).length;
  const registeredThisMonth = students.filter((s) => s.enrollmentDate && isSameMonth(s.enrollmentDate)).length;

  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" description="خلاصه امروز و دسترسی سریع به کارهای روزمره" />

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="دانش‌آموزان فعال" value={toPersianDigits(activeCount)} accent="paid" />
          <StatCard label="ثبت‌نام امروز" value={toPersianDigits(registeredToday)} accent="action" />
          <StatCard label="ثبت‌نام این ماه" value={toPersianDigits(registeredThisMonth)} accent="warning" />
        </div>
      )}

      <Card title="شروع سریع" className="mt-6">
        <p className="mb-4 text-sm text-ink/70 dark:text-paper/70">
          گزارش‌های مالی برای نقش شما در دسترس نیست. از اینجا می‌توانید دانش‌آموزان را مدیریت کنید.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Reuses StudentsPage's existing create-student form — this just
              tells that page to open it automatically instead of duplicating
              the form here. */}
          <Link to="/students" state={{ openCreateForm: true }} className="btn-primary justify-center">
            + ثبت‌نام دانش‌آموز جدید
          </Link>
          <Link to="/students" className="btn-secondary justify-center">
            مشاهده دانش‌آموزان
          </Link>
          <Link to="/students/archived" className="btn-secondary justify-center">
            دانش‌آموزان غیرفعال
          </Link>
        </div>
      </Card>

      <TodayChecklist />
    </div>
  );
}

// Placeholder "today's checklist" for the staff dashboard — attendance
// follow-up, incomplete-document follow-up, and upcoming tuition
// reminders. NOT wired to a real API yet: the backend's attendance module
// only exposes a teacher-facing recording endpoint today (no staff-facing
// list), and there's no student-documents or notifications endpoint
// anywhere in this frontend to call. Shown here with sample data, clearly
// labeled, so the shape/layout is ready to swap for real queries the
// moment those endpoints exist — see CHANGELOG.
const SAMPLE_ATTENDANCE_PENDING = [
  { id: 's1', label: 'کلاس دوم - ریاضی', detail: '۱۸ دانش‌آموز، هنوز ثبت نشده' },
  { id: 's2', label: 'کلاس سوم - علوم', detail: '۲۲ دانش‌آموز، هنوز ثبت نشده' },
];

const SAMPLE_INCOMPLETE_DOCUMENTS = [
  { id: 'd1', label: 'سارا محمدی', detail: 'کپی شناسنامه ناقص است' },
  { id: 'd2', label: 'امیر رضایی', detail: 'عکس پرسنلی ارسال نشده' },
  { id: 'd3', label: 'نگار احمدی', detail: 'مدرک تحصیلی قبلی ناقص است' },
];

const SAMPLE_TUITION_REMINDERS = [
  { id: 'r1', label: 'محمد کریمی', detail: 'سررسید قسط: ۳ روز دیگر' },
  { id: 'r2', label: 'زهرا حسینی', detail: 'سررسید قسط: فردا' },
];

function ChecklistSection({
  title,
  icon,
  items,
  actionLabel,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  items: { id: string; label: string; detail: string }[];
  actionLabel: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-lg border border-line p-3.5 dark:border-white/10">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink dark:text-paper">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-paper/60">
          {icon}
        </span>
        {title}
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-ink/40 dark:text-paper/40">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md bg-paper px-2.5 py-2 text-xs dark:bg-white/5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-ink/80 dark:text-paper/80">{item.label}</div>
                <div className="truncate text-ink/45 dark:text-paper/45">{item.detail}</div>
              </div>
              <button
                type="button"
                disabled
                title="پس از اتصال به بک‌اند فعال می‌شود"
                className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-ink/40 transition-transform active:scale-[0.97] disabled:cursor-not-allowed dark:border-white/15 dark:text-paper/40"
              >
                {actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TodayChecklist() {
  return (
    <Card title="چک‌لیست امروز" className="mt-6">
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
        <AlertIcon size={14} className="mt-0.5 shrink-0" />
        <span>
          این بخش فعلاً با داده نمونه نمایش داده می‌شود. برای فعال‌سازی واقعی، ماژول‌های حضور و غیاب (برای کارمندان)،
          مدارک دانش‌آموزان، و یادآوری‌های خودکار باید در فرانت‌اند وصل شوند.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChecklistSection
          title="حضور و غیاب ثبت‌نشده"
          icon={<AttendanceIcon size={16} />}
          items={SAMPLE_ATTENDANCE_PENDING}
          actionLabel="ثبت حضور"
          emptyLabel="همه‌ی کلاس‌ها ثبت شده‌اند"
        />
        <ChecklistSection
          title="مدارک ناقص"
          icon={<AssignmentsIcon size={16} />}
          items={SAMPLE_INCOMPLETE_DOCUMENTS}
          actionLabel="پیگیری"
          emptyLabel="مدرک ناقصی باقی نمانده است"
        />
        <ChecklistSection
          title="یادآوری سررسید قسط"
          icon={<CalendarIcon size={16} />}
          items={SAMPLE_TUITION_REMINDERS}
          actionLabel="ارسال یادآوری"
          emptyLabel="سررسید نزدیکی وجود ندارد"
        />
      </div>
    </Card>
  );
}

// Sprint 2.1 — no endpoint anywhere in this frontend returns a teacher
// count yet (DashboardView has no `teachers` field — see
// analytics.types.ts — and there's no GET /teachers list either). Shown
// as a clearly-labeled mock, same pattern as the SAMPLE_* checklist data
// above, until a real count is exposed.
const MOCK_TOTAL_TEACHERS = 24;

// Sprint 2.2 — Action Center. No backend endpoint aggregates these four
// signals into one feed (absences, overdue payments, registrations,
// announcements each live behind their own module/role, same situation
// as the StaffDashboard's SAMPLE_* checklist above), so this is shown
// with clearly-labeled sample data until a real feed exists.
type ActionSeverity = 'critical' | 'warning' | 'info';

interface ActionCenterItem {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  severity: ActionSeverity;
}

const ACTION_CENTER_ITEMS: ActionCenterItem[] = [
  {
    id: 'ac1',
    icon: <AttendanceIcon size={18} />,
    title: 'غایبان امروز',
    description: '۱۲ دانش‌آموز امروز غایب ثبت شده‌اند',
    severity: 'warning',
  },
  {
    id: 'ac2',
    icon: <AlertIcon size={18} />,
    title: 'پرداخت‌های معوق',
    description: '۸ قسط از سررسید خود گذشته‌اند',
    severity: 'critical',
  },
  {
    id: 'ac3',
    icon: <AssignmentsIcon size={18} />,
    title: 'ثبت‌نام‌های در انتظار',
    description: '۵ درخواست ثبت‌نام نیاز به بررسی دارند',
    severity: 'warning',
  },
  {
    id: 'ac4',
    icon: <NotificationIcon size={18} />,
    title: 'اطلاعیه‌های منتشرنشده',
    description: '۲ اطلاعیه به‌صورت پیش‌نویس باقی مانده‌اند',
    severity: 'info',
  },
];

const SEVERITY_CONFIG: Record<ActionSeverity, { label: string; className: string }> = {
  critical: { label: 'بحرانی', className: 'bg-overdue/10 text-overdue border-overdue/25' },
  warning: { label: 'هشدار', className: 'bg-warning/10 text-warning border-warning/25' },
  info: { label: 'اطلاعیه', className: 'bg-action-soft text-action border-action/25' },
};

// Same visual language as StatusBadge (badge shell + accent-tinted
// border/text from index.css), sized for a generic severity rather than
// StatusBadge's InstallmentStatus-only union.
function SeverityBadge({ severity }: { severity: ActionSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span className={`badge ${config.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

// Sprint 2.2 — Quick Actions. Visual shortcuts to existing pages only:
// `to` is omitted entirely when no school_admin-accessible route exists
// yet for that action (see QuickActionTile below, same disabled-tile
// convention as ChecklistSection's disabled button), so a tile never
// links to a route that isn't already in App.tsx.
interface QuickAction {
  id: string;
  icon: ReactNode;
  label: string;
  caption: string;
  to?: string;
}

// Sprint 2.3 — Financial Overview summary. Monthly revenue, tuition
// collected and outstanding balance all come straight from the existing
// finance/monthlyPayments data useDashboard() already fetches. Collection
// rate is derived from totalPaid/totalTuition (same ratio-of-two-existing-
// numbers technique FinancialDashboard's collectionRate already uses
// below) — it only has no real value when totalTuition is 0 (no tuition
// plans yet), in which case this clearly-labeled mock takes over instead
// of a misleading 0%/NaN.
const MOCK_COLLECTION_RATE = 72;

// Sprint 2.4 — Academic Overview. Attendance rate and average assessment
// score both come from useDashboard() (attendance.attendanceRate,
// assessments.averageScore — already used elsewhere on this page). Class
// count and teacher workload have no backend support anywhere in this
// frontend yet (no classes/sections endpoint, no per-teacher load
// endpoint), so both are shown as clearly-labeled mocks, same pattern as
// MOCK_TOTAL_TEACHERS/MOCK_COLLECTION_RATE above.
const MOCK_ACTIVE_CLASSES_TODAY = 18;
const MOCK_TEACHER_WORKLOAD_PERCENT = 78;

// Sprint 2.5 — Recent Activity feed. Payments and attendance entries are
// real (data.recentActivity.payments / .attendance — already returned by
// GET /analytics/dashboard but not consumed anywhere on this page until
// now). Student registration and teacher-assignment events have no
// per-event backend feed anywhere in this frontend (only aggregate
// monthly counts exist for registrations — see monthlyRegistrations
// above — and there's no class-assignment endpoint at all), so those two
// are shown as clearly-labeled mocks.
type ActivityKind = 'registration' | 'payment' | 'attendance' | 'teacher_assignment';

interface RecentActivityItem {
  id: string;
  kind: ActivityKind;
  icon: ReactNode;
  title: string;
  description: string;
  timestamp: string;
  mock: boolean;
}

// Same icon-badge tinting convention as KPICard/StatCard's own ICON_BG
// maps elsewhere in this codebase — reused here for the timeline dots.
const ACTIVITY_ICON_BG: Record<ActivityKind, string> = {
  registration: 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light',
  payment: 'bg-paid-soft text-paid dark:bg-paid/15',
  attendance: 'bg-warning-soft text-warning dark:bg-warning/15',
  teacher_assignment: 'bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-paper/60',
};

// Fixed backward offsets from "now" — computed at render time (see
// SchoolAdminDashboard) so the relative-time labels ("۴۰ دقیقه پیش")
// stay accurate for as long as the tab stays open.
const MOCK_ACTIVITY_TEMPLATES: {
  id: string;
  kind: ActivityKind;
  icon: ReactNode;
  title: string;
  description: string;
  offsetMinutes: number;
}[] = [
  {
    id: 'mock-registration-1',
    kind: 'registration',
    icon: <StudentIcon size={16} />,
    title: 'دانش‌آموز جدید ثبت‌نام شد',
    description: 'یک دانش‌آموز جدید در سامانه ثبت‌نام شد (نمونه)',
    offsetMinutes: 40,
  },
  {
    id: 'mock-teacher-assignment-1',
    kind: 'teacher_assignment',
    icon: <TeacherIcon size={16} />,
    title: 'معلم به کلاس تخصیص یافت',
    description: 'یک معلم به یک کلاس درسی جدید اختصاص یافت (نمونه)',
    offsetMinutes: 150,
  },
];

// Sprint A1.1 (Dashboard Foundation) — the 6 shortcuts requested for the
// Quick Actions section. Each `to` is an existing, already-registered
// route this role can already reach (see App.tsx): /students,
// /settings (grades/classes management lives there — see
// useStudents.ts's Grade/Class hooks), /attendance, /installments
// (closest existing route to "tuition" — there is no separate
// /tuition route), and /reports. "افزودن معلم" has no `to`: the only
// account-creation page, /users, is super_admin-only (see App.tsx), and
// /teacher-assignments only assigns an *existing* teacher to a class —
// neither is a real "add teacher" destination for this role, so this
// tile stays a disabled placeholder rather than linking somewhere
// misleading.
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-student',
    icon: <StudentIcon size={22} />,
    label: 'افزودن دانش‌آموز',
    caption: 'ثبت‌نام دانش‌آموز جدید',
    to: '/students',
  },
  {
    id: 'add-teacher',
    icon: <TeacherIcon size={22} />,
    label: 'افزودن معلم',
    caption: 'به‌زودی',
  },
  {
    id: 'manage-classes',
    icon: <ClassIcon size={22} />,
    label: 'مدیریت کلاس‌ها',
    caption: 'پایه‌ها، شعب و سال تحصیلی',
    to: '/settings',
  },
  {
    id: 'attendance',
    icon: <AttendanceIcon size={22} />,
    label: 'حضور و غیاب',
    caption: 'ثبت و مشاهده‌ی حضور امروز',
    to: '/attendance',
  },
  {
    id: 'tuition',
    icon: <TuitionIcon size={22} />,
    label: 'شهریه',
    caption: 'اقساط و پرداخت‌ها',
    to: '/installments',
  },
  {
    id: 'reports',
    icon: <ReportsIcon size={22} />,
    label: 'گزارش‌ها',
    caption: 'گزارش‌های مالی و آموزشی',
    to: '/reports',
  },
];

// Shared tile renderer for both cases above — a real <Link> when a route
// exists, otherwise a disabled <button> (same semantics as
// ChecklistSection's disabled action button: focusable-but-inert,
// announced as disabled to assistive tech, no dead href). Keeping one
// component avoids duplicating the tile markup/classNames twice.
function QuickActionTile({ action }: { action: QuickAction }) {
  const tileClass =
    'group flex flex-col items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-4 text-center shadow-card transition-all duration-150 dark:border-white/10 dark:bg-white/[0.03] sm:py-5';
  const iconClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-action-soft text-action transition-colors dark:bg-action/15 dark:text-action-light';

  if (!action.to) {
    return (
      <button
        type="button"
        disabled
        title="این بخش هنوز صفحه‌ی مدیریت مستقلی ندارد"
        className={`${tileClass} cursor-not-allowed opacity-50`}
      >
        <span className={iconClass}>{action.icon}</span>
        <span className="text-sm font-medium text-ink dark:text-paper">{action.label}</span>
        <span className="text-[11px] text-ink/45 dark:text-paper/45">{action.caption}</span>
      </button>
    );
  }

  return (
    <Link
      to={action.to}
      className={`${tileClass} hover:-translate-y-0.5 hover:border-action/30 hover:shadow-pop active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/50`}
    >
      <span className={`${iconClass} group-hover:bg-action group-hover:text-white`}>{action.icon}</span>
      <span className="text-sm font-medium text-ink dark:text-paper">{action.label}</span>
      <span className="text-[11px] text-ink/45 dark:text-paper/45">{action.caption}</span>
    </Link>
  );
}

// Sprint A1.2 (Operational Dashboard) — Attention Required + Upcoming.
// A single tile shape covers both sections: 'ready' tiles show a real
// number pulled from data useDashboard() already fetches (no new
// request — see SchoolAdminDashboard below), 'placeholder' tiles show a
// polished "not connected yet" empty state instead of a fabricated
// number. Reusing one type/component for both sections (rather than two
// near-identical ones) is the "avoid duplicate code" requirement for
// this sprint.
type SignalTile =
  | {
      id: string;
      status: 'ready';
      icon: ReactNode;
      title: string;
      value: string;
      description: string;
      accent: StatAccent;
      to: string;
    }
  | {
      id: string;
      status: 'placeholder';
      icon: ReactNode;
      title: string;
      description: string;
    };

// Same accent → color mapping StatCard keeps privately, duplicated here
// on purpose — same "small per-page duplication over new shared
// abstractions" convention already noted at the top of this file, since
// SignalTile's layout (icon + title + big value + caption, as a full
// clickable tile) isn't a fit for StatCard's own props.
const SIGNAL_ICON_BG: Record<StatAccent, string> = {
  default: 'bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-paper/60',
  action: 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light',
  paid: 'bg-paid-soft text-paid dark:bg-paid/15',
  warning: 'bg-warning-soft text-warning dark:bg-warning/15',
  overdue: 'bg-overdue-soft text-overdue dark:bg-overdue/15',
};

const SIGNAL_VALUE_COLOR: Record<StatAccent, string> = {
  default: 'text-ink dark:text-paper',
  action: 'text-action',
  paid: 'text-paid',
  warning: 'text-warning',
  overdue: 'text-overdue',
};

function SignalTileCard({ tile }: { tile: SignalTile }) {
  if (tile.status === 'placeholder') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line p-4 dark:border-white/15">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink/40 dark:bg-white/10 dark:text-paper/40">
            {tile.icon}
          </span>
          <span className="text-sm font-medium text-ink/70 dark:text-paper/70">{tile.title}</span>
        </div>
        <p className="text-xs leading-relaxed text-ink/45 dark:text-paper/45">{tile.description}</p>
        <span className="badge w-fit border-ink/10 bg-ink/5 text-ink/45 dark:border-white/10 dark:bg-white/10 dark:text-paper/45">
          به‌زودی
        </span>
      </div>
    );
  }

  return (
    <Link
      to={tile.to}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-action/30 hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/50 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${SIGNAL_ICON_BG[tile.accent]}`}>
          {tile.icon}
        </span>
        <span className="text-sm font-medium text-ink dark:text-paper">{tile.title}</span>
      </div>
      <div className={`tabular text-xl font-bold ${SIGNAL_VALUE_COLOR[tile.accent]}`}>{tile.value}</div>
      <p className="text-xs leading-relaxed text-ink/50 dark:text-paper/50">{tile.description}</p>
    </Link>
  );
}

// Sprint A1.2 — Upcoming. No backend module anywhere in this frontend
// covers school events, exam scheduling, or generic deadlines (only
// installment due dates exist, already surfaced elsewhere on this page
// and in the Attention Required section below) — so unlike Attention
// Required, every tile here is a placeholder. No new request is made for
// this section at all.
const UPCOMING_TILES: SignalTile[] = [
  {
    id: 'upcoming-events',
    status: 'placeholder',
    icon: <CalendarIcon size={18} />,
    title: 'رویدادهای پیش‌رو',
    description: 'رویدادهای مدرسه پس از اتصال ماژول تقویم/رویدادها در همین‌جا نمایش داده می‌شوند.',
  },
  {
    id: 'upcoming-exams',
    status: 'placeholder',
    icon: <AssignmentsIcon size={18} />,
    title: 'آزمون‌های پیش‌رو',
    description: 'زمان‌بندی آزمون‌ها پس از اتصال ماژول امتحانات در همین‌جا نمایش داده می‌شود.',
  },
  {
    id: 'upcoming-deadlines',
    status: 'placeholder',
    icon: <ListIcon size={18} />,
    title: 'سررسیدهای پیش‌رو',
    description: 'مهلت‌های مهم غیر از اقساط شهریه پس از اتصال ماژول مربوطه در همین‌جا نمایش داده می‌شوند.',
  },
];

// Lightweight visual grouping for the macro-sections of the page below —
// a muted label + divider line above a cluster of sections. Purely
// presentational and new to this sprint: it changes how sections are
// clustered and spaced, not what any section inside it renders.
// SectionHeader (used *inside* each group, for individual sections) is
// completely untouched.
function DashboardGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-4 flex items-center gap-3">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink/35 dark:text-paper/35">
          {label}
        </span>
        <span className="h-px flex-1 bg-line dark:bg-white/10" />
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

// school_admin dashboard, backed by the single GET /analytics/dashboard
// call (useDashboard()). Unlike FinancialDashboard below, the finance
// totals here are exact (totalTuition/totalPaid/totalUnpaid/overdueAmount
// come straight from the endpoint), plus attendance and assessments
// summaries and a real monthly-payments trend — none of which existed on
// the dashboard before. accountant/staff never render this component.
function SchoolAdminDashboard() {
  const { user } = useAuth();
  const dashboardQuery = useDashboard();
  const data = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;
  const error = dashboardQuery.isError;

  const finance = data?.finance ?? null;
  const attendance = data?.attendance ?? null;
  const assessments = data?.assessments ?? null;
  const recentActivity = data?.recentActivity ?? null;
  const monthlyPayments = data?.charts.monthlyPayments ?? [];
  const monthlyRegistrations = data?.charts.monthlyRegistrations ?? [];

  // Sprint 2.5 — merge real payment/attendance events with the two mock
  // event kinds, then sort newest-first. Composed here at render time
  // only; no new request, no change to what useDashboard() fetches.
  const recentActivityItems: RecentActivityItem[] = [
    ...(recentActivity?.payments ?? []).map((p): RecentActivityItem => ({
      id: `payment-${p.id}`,
      kind: 'payment',
      icon: <TuitionIcon size={16} />,
      title: 'پرداخت دریافت شد',
      description: `${p.studentFullName} — ${formatToman(p.amount)}`,
      timestamp: p.paidAt,
      mock: false,
    })),
    ...(recentActivity?.attendance ?? []).map((a): RecentActivityItem => ({
      id: `attendance-${a.id}`,
      kind: 'attendance',
      icon: <AttendanceIcon size={16} />,
      title: 'حضور و غیاب ثبت شد',
      description: `${a.studentFullName} — وضعیت: ${a.status}`,
      timestamp: a.date,
      mock: false,
    })),
    ...MOCK_ACTIVITY_TEMPLATES.map((t): RecentActivityItem => ({
      id: t.id,
      kind: t.kind,
      icon: t.icon,
      title: t.title,
      description: t.description,
      timestamp: new Date(Date.now() - t.offsetMinutes * 60 * 1000).toISOString(),
      mock: true,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  // Current-month points are just the last entry of each trend series
  // that useDashboard() already fetched — no new request added.
  const currentMonthRevenue = monthlyPayments[monthlyPayments.length - 1]?.totalIncome ?? 0;
  const currentMonthRegistrations = monthlyRegistrations[monthlyRegistrations.length - 1]?.count ?? 0;

  // Sprint 2.3 — collection rate for the Financial Overview summary.
  // null only when totalTuition is 0 (nothing to divide by yet); the
  // labeled mock (MOCK_COLLECTION_RATE) covers that case at render time.
  const collectionRate =
    finance && finance.totalTuition > 0 ? (finance.totalPaid / finance.totalTuition) * 100 : null;

  const todayLabel = formatDate(new Date().toISOString());

  // Sprint A1.2 — Attention Required tiles. Three of four reuse fields
  // useDashboard() already returns but nothing on this page rendered
  // until now (finance.overdueAmount, attendance.absentToday/lateToday,
  // assessments.lowestStudents — see analytics.types.ts); no new
  // request. "Students without portal accounts" has no backing field
  // anywhere in this frontend (no such aggregate on /students or
  // DashboardStudentsSummary), so it stays a placeholder — no fabricated
  // count.
  const attentionTiles: SignalTile[] = [
    {
      id: 'overdue-tuition',
      status: 'ready',
      icon: <AlertIcon size={18} />,
      title: 'شهریه‌های معوق',
      value: formatToman(finance?.overdueAmount ?? 0),
      description: 'مجموع مبلغ قسط‌هایی که از سررسید گذشته‌اند — برای پیگیری وارد صفحه اقساط شوید.',
      accent: 'overdue',
      to: '/installments',
    },
    {
      id: 'attendance-today',
      status: 'ready',
      icon: <AttendanceIcon size={18} />,
      title: 'غیبت و تأخیر امروز',
      value: toPersianDigits((attendance?.absentToday ?? 0) + (attendance?.lateToday ?? 0)),
      description: `${toPersianDigits(attendance?.absentToday ?? 0)} غایب و ${toPersianDigits(
        attendance?.lateToday ?? 0,
      )} با تأخیر — برای پیگیری وارد صفحه حضور و غیاب شوید.`,
      accent: 'warning',
      to: '/attendance',
    },
    {
      id: 'low-performers',
      status: 'ready',
      icon: <ScoreIcon size={18} />,
      title: 'نیازمند بررسی نمره',
      value: toPersianDigits(assessments?.lowestStudents.length ?? 0),
      description: 'دانش‌آموزان با پایین‌ترین میانگین ارزیابی — برای بررسی وارد لیست دانش‌آموزان شوید.',
      accent: 'action',
      to: '/students',
    },
    {
      id: 'no-portal-account',
      status: 'placeholder',
      icon: <LockIcon size={18} />,
      title: 'دانش‌آموزان بدون حساب کاربری',
      description: 'تعداد دانش‌آموزان بدون حساب پورتال، پس از افزودن این شاخص به بک‌اند، در همین‌جا نمایش داده می‌شود.',
    },
  ];

  const paymentTrendPoints = monthlyPayments.map((p) => ({
    ...p,
    label: `${persianMonthNames[p.month - 1]} ${p.year}`,
  }));

  const topStudentColumns: TableColumn<DashboardStudentAverage>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (s) => (
        <Link to={`/students/${s.studentId}`} className="font-medium text-action hover:underline">
          {s.studentFullName}
        </Link>
      ),
    },
    {
      key: 'average',
      header: 'میانگین',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (s) => toPersianDigits(s.average.toFixed(1)),
    },
  ];

  return (
    <div className="fade-in">
      {/* Sprint A1.1 (Dashboard Foundation) — header: welcome title, a
          fixed descriptive subtitle, and the existing dynamic school
          summary line (unchanged data, just demoted to a secondary line
          under the subtitle for clearer hierarchy). Current academic
          year is intentionally not shown here — GET /analytics/dashboard
          (useDashboard) has no such field (see analytics.types.ts), and
          Sprint A1.1 doesn't fetch anything new — see the "left for
          Sprint A1.2" note in the handoff. */}
      <div className="mb-6 rounded-xl border border-line bg-white p-5 shadow-card dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink dark:text-paper sm:text-2xl">
              خوش آمدید{user?.fullName ? `، ${user.fullName}` : ''}
            </h1>
            <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
              نمای کلی وضعیت مدرسه و دسترسی سریع به کارهای روزانه
            </p>
            <p className="mt-2.5 text-xs text-ink/45 dark:text-paper/45">
              {loading
                ? 'در حال بارگذاری خلاصه مدرسه...'
                : `هم‌اکنون ${toPersianDigits(data?.students.total ?? 0)} دانش‌آموز (${toPersianDigits(
                    data?.students.active ?? 0,
                  )} فعال) در مدرسه ثبت شده و نرخ حضور امروز ${toPersianDigits(
                    Math.round(attendance?.attendanceRate ?? 0),
                  )}٪ است.`}
            </p>
          </div>
          <div className="shrink-0 rounded-lg bg-paper px-3.5 py-2 text-xs font-medium text-ink/60 dark:bg-white/5 dark:text-paper/60">
            {todayLabel}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">
          خطا در بارگذاری اطلاعات داشبورد
        </div>
      )}

      <DashboardGroup label="نمای کلی و اقدامات سریع">
        {/* Sprint A1.1 — KPI Overview: same 6 metrics as before (no new
            values), grouped under a labeled section for clearer hierarchy
            and given a bit more breathing room at each breakpoint. */}
        <div>
          <SectionHeader title="نمای کلی شاخص‌ها" description="مهم‌ترین اعداد مدرسه در یک نگاه" />
          {loading ? (
            <SkeletonCards count={6} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              <StatCard
                label="کل دانش‌آموزان"
                value={toPersianDigits(data?.students.total ?? 0)}
                icon={<UsersIcon />}
              />
              <StatCard
                label="کل معلمان"
                value={toPersianDigits(MOCK_TOTAL_TEACHERS)}
                accent="action"
                icon={<TeacherIcon />}
              />
              <StatCard
                label="حضور امروز"
                value={`${toPersianDigits(Math.round(attendance?.attendanceRate ?? 0))}٪`}
                accent="paid"
                icon={<AttendanceIcon />}
              />
              <StatCard
                label="درآمد این ماه"
                value={formatToman(currentMonthRevenue)}
                accent="paid"
                icon={<TuitionIcon />}
              />
              <StatCard
                label="شهریه معوق"
                value={formatToman(finance?.totalUnpaid ?? 0)}
                accent="overdue"
                icon={<AlertIcon />}
              />
              <StatCard
                label="ثبت‌نام‌های جدید"
                value={toPersianDigits(currentMonthRegistrations)}
                accent="action"
                icon={<CalendarIcon />}
              />
            </div>
          )}
        </div>

        {/* Sprint A1.1 — Quick Actions. Visual shortcuts only (see
            QUICK_ACTIONS / QuickActionTile above) — 5 of 6 link to routes
            that already exist and are reachable by this role; "افزودن
            معلم" has none yet, so it renders disabled rather than linking
            anywhere. */}
        <div>
          <SectionHeader title="اقدامات سریع" description="میان‌برهای پراستفاده برای کارهای روزانه" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionTile key={action.id} action={action} />
            ))}
          </div>
        </div>
      </DashboardGroup>

      <DashboardGroup label="نیازمند توجه">
        {/* Sprint A1.2 — Attention Required. Real numbers where
            useDashboard() already has the field (overdue tuition,
            today's absences/lateness, low-scoring students); a single
            clearly-labeled placeholder where no field exists yet
            (students without portal accounts). No new request, no
            fabricated figures. */}
        <div>
          <SectionHeader
            title="نیازمند توجه"
            description="موضوعاتی که این هفته احتمالاً به پیگیری نیاز دارند"
          />
          {loading ? (
            <SkeletonCards count={4} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {attentionTiles.map((tile) => (
                <SignalTileCard key={tile.id} tile={tile} />
              ))}
            </div>
          )}
        </div>

        {/* Sprint 2.2 — Action Center (unchanged content — only its
            position moved, to sit next to the other "needs attention"
            signals above). */}
        <div>
          <Card title="مرکز اقدامات">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACTION_CENTER_ITEMS.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-line p-3.5 dark:border-white/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-paper/60">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink dark:text-paper">{item.title}</span>
                      <SeverityBadge severity={item.severity} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink/55 dark:text-paper/55">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Sprint A1.2 — Upcoming. Forward-looking placeholders only
            (events, exams, deadlines) — no backend module for any of
            these exists yet anywhere in this frontend, and no new
            request is made for this section. */}
        <div>
          <SectionHeader title="پیش‌رو" description="برنامه‌ریزی عملیاتی برای روزهای آینده" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {UPCOMING_TILES.map((tile) => (
              <SignalTileCard key={tile.id} tile={tile} />
            ))}
          </div>
        </div>
      </DashboardGroup>

      <DashboardGroup label="عملکرد امروز">
      {/* Attendance summary + Assessments summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="خلاصه حضور و غیاب امروز">
          {loading ? (
            <SkeletonRows rows={3} cols={1} />
          ) : (
            <div className="flex flex-col gap-4">
              <KPICard
                label="نرخ حضور کلی"
                value={`${toPersianDigits(Math.round(attendance?.attendanceRate ?? 0))}٪`}
                icon={<TargetIcon />}
                accent="action"
                progress={attendance?.attendanceRate ?? 0}
              />
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  plain
                  label="حاضر امروز"
                  value={toPersianDigits(attendance?.presentToday ?? 0)}
                  accent="paid"
                />
                <StatCard
                  plain
                  label="غایب امروز"
                  value={toPersianDigits(attendance?.absentToday ?? 0)}
                  accent="overdue"
                />
                <StatCard
                  plain
                  label="تأخیر امروز"
                  value={toPersianDigits(attendance?.lateToday ?? 0)}
                  accent="warning"
                />
              </div>
            </div>
          )}
        </Card>

        <Card
          title="خلاصه ارزیابی‌ها"
          action={
            <Link to="/students" className="text-xs font-medium text-action hover:underline">
              مشاهده دانش‌آموزان ←
            </Link>
          }
        >
          {loading ? (
            <SkeletonRows rows={5} cols={2} />
          ) : (
            <>
              <div className="mb-4 rounded-lg bg-paper px-4 py-3 dark:bg-white/5">
                <div className="text-sm text-ink/60 dark:text-paper/60">میانگین کل مدرسه</div>
                <div className="tabular mt-1 text-xl font-bold text-ink dark:text-paper">
                  {assessments?.averageScore != null ? toPersianDigits(assessments.averageScore.toFixed(1)) : '—'}
                </div>
              </div>
              <Table
                columns={topStudentColumns}
                data={assessments?.topStudents ?? []}
                rowKey={(s) => s.studentId}
                emptyMessage="هنوز ارزیابی‌ای ثبت نشده است."
              />
            </>
          )}
        </Card>
      </div>

      {/* Sprint 2.4 — Academic Overview: a separate section from the
          Attendance/Assessments cards above (those are left untouched).
          Same Card/StatCard/SectionHeader/badge components as the rest
          of the page; no new chart. */}
      <div>
        <SectionHeader title="نمای کلی آموزشی" description="خلاصه وضعیت حضور، ارزیابی‌ها، کلاس‌ها و بار کاری معلمان" />
        {loading ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="نرخ حضور"
              value={`${toPersianDigits(Math.round(attendance?.attendanceRate ?? 0))}٪`}
              accent="paid"
              icon={<AttendanceIcon />}
            />
            <StatCard
              label="میانگین نمره ارزیابی"
              value={assessments?.averageScore != null ? toPersianDigits(assessments.averageScore.toFixed(1)) : '—'}
              accent="action"
              icon={<ScoreIcon />}
            />
            <StatCard
              label="کلاس‌های فعال امروز"
              value={toPersianDigits(MOCK_ACTIVE_CLASSES_TODAY)}
              accent="default"
              icon={<ClassIcon />}
            />
            <StatCard
              label="بار کاری معلمان"
              value={`${toPersianDigits(MOCK_TEACHER_WORKLOAD_PERCENT)}٪`}
              accent="warning"
              icon={<TeacherIcon />}
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/50 dark:text-paper/50">
          <SeverityBadge severity="info" />
          <span>«کلاس‌های فعال امروز» و «بار کاری معلمان» فعلاً داده نمونه هستند تا ماژول مربوطه به بک‌اند وصل شود.</span>
        </div>
      </div>
      </DashboardGroup>

      <DashboardGroup label="روند مالی">
      {/* Sprint 2.3 — Financial Overview (was "Monthly payments trend").
          Same LineChart as before, just regrouped with a financial
          summary for clearer hierarchy — no new chart added. */}
      <div>
        <SectionHeader title="نمای کلی مالی" description="روند پرداخت‌های ماهانه و خلاصه وضعیت مالی مدرسه" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <Card className="lg:col-span-2">
            {loading ? (
              <SkeletonRows rows={3} cols={4} />
            ) : (
              <div dir="ltr" className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paymentTrendPoints}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={12} tickFormatter={(v) => toPersianDigits(String(v))} />
                    <Tooltip formatter={(value: number) => formatToman(value)} />
                    <Line type="monotone" dataKey="totalIncome" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {loading ? (
            <SkeletonCards count={4} />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <StatCard label="درآمد این ماه" value={formatToman(currentMonthRevenue)} accent="paid" icon={<TuitionIcon />} />
              <StatCard label="شهریه وصول‌شده" value={formatToman(finance?.totalPaid ?? 0)} accent="paid" icon={<CheckIcon />} />
              <StatCard label="مانده معوق" value={formatToman(finance?.totalUnpaid ?? 0)} accent="overdue" icon={<AlertIcon />} />
              <StatCard
                label="نرخ وصول"
                value={
                  collectionRate !== null
                    ? `${toPersianDigits(Math.round(collectionRate))}٪`
                    : `${toPersianDigits(MOCK_COLLECTION_RATE)}٪ (نمونه)`
                }
                accent="action"
                icon={<TargetIcon />}
              />
            </div>
          )}
        </div>
      </div>
      </DashboardGroup>

      <DashboardGroup label="فعالیت‌های اخیر">
      {/* Sprint A1.1 — Recent Activity: same items/order/sort as before
          (payments + attendance are real, from data.recentActivity;
          registration/teacher-assignment stay clearly-marked mocks —
          see MOCK_ACTIVITY_TEMPLATES above), restyled as individual
          rounded rows instead of a plain list so each entry reads as its
          own card while keeping the connecting timeline thread. */}
      <div>
        <SectionHeader title="فعالیت‌های اخیر" description="جدیدترین رویدادهای ثبت‌شده در مدرسه" />
        <Card>
          {loading ? (
            <SkeletonRows rows={5} cols={1} />
          ) : recentActivityItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/45 dark:text-paper/45">
              هنوز فعالیتی ثبت نشده است.
            </p>
          ) : (
            <ul className="-my-1">
              {recentActivityItems.map((item, index) => (
                <li key={item.id} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-navy-dark ${ACTIVITY_ICON_BG[item.kind]}`}
                    >
                      {item.icon}
                    </span>
                    {index < recentActivityItems.length - 1 && (
                      <span className="mt-0.5 w-px flex-1 bg-line dark:bg-white/10" />
                    )}
                  </div>
                  <div
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-paper dark:hover:bg-white/5 ${
                      index < recentActivityItems.length - 1 ? 'mb-1' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-medium text-ink dark:text-paper">{item.title}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.mock && <SeverityBadge severity="info" />}
                        <span className="tabular text-xs text-ink/40 dark:text-paper/40">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink/55 dark:text-paper/55">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </DashboardGroup>
    </div>
  );
}

function FinancialDashboard() {
  const now = new Date();
  const summaryQuery = useOverdueSummary();
  const debtorsQuery = useDebtorStudents();
  const incomeQuery = useMonthlyIncome(now.getFullYear(), now.getMonth() + 1);
  // GET /payments (no studentId filter) already exists on the backend and
  // was already wired up in usePayments() — just not consumed by any page
  // yet (see hooks/usePayments.ts). Reused here, unmodified, for a
  // school-wide "recent activity" feed instead of adding a new endpoint.
  const paymentsQuery = usePayments();

  const summary = summaryQuery.data ?? null;
  const debtors = debtorsQuery.data ?? [];
  const monthIncome = incomeQuery.data ?? null;
  const recentPayments = paymentsQuery.data ?? [];
  const loading =
    summaryQuery.isLoading || debtorsQuery.isLoading || incomeQuery.isLoading || paymentsQuery.isLoading;
  const error = summaryQuery.isError || debtorsQuery.isError || incomeQuery.isError || paymentsQuery.isError;

  const totalOutstanding = debtors.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const paidThisMonth = monthIncome?.totalIncome ?? 0;
  const totalDue = totalOutstanding + paidThisMonth;
  // Presentational only — how much of this month's total due has already
  // been collected. Derived entirely from the two numbers above, no new
  // request or stored value.
  const collectionRate = totalDue > 0 ? (paidThisMonth / totalDue) * 100 : 0;

  const pieData = [
    { name: 'پرداخت‌شده (این ماه)', value: paidThisMonth, color: '#059669' },
    { name: 'باقی‌مانده', value: totalOutstanding, color: '#DC2626' },
  ];

  const topDebtors = [...debtors].sort((a, b) => b.outstandingBalance - a.outstandingBalance).slice(0, 5);
  const latestPayments = [...recentPayments]
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, 5);

  const debtorColumns: TableColumn<DebtorStudent>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (d) => (
        <Link to={`/students/${d.studentId}`} className="font-medium text-action hover:underline">
          {d.studentFullName}
        </Link>
      ),
    },
    {
      key: 'balance',
      header: 'مانده بدهی',
      align: 'left',
      cellClassName: 'tabular font-medium text-overdue',
      render: (d) => formatToman(d.outstandingBalance),
    },
  ];

  const activityColumns: TableColumn<PaymentWithContext>[] = [
    {
      key: 'student',
      header: 'دانش‌آموز',
      render: (p) => {
        const student = p.installment.tuitionPlan?.student;
        return student ? (
          <Link to={`/students/${student.id}`} className="font-medium text-action hover:underline">
            {student.fullName}
          </Link>
        ) : (
          <span className="text-ink/40">—</span>
        );
      },
    },
    {
      key: 'method',
      header: 'روش پرداخت',
      render: (p) => (p.paymentMethod ? paymentMethodLabels[p.paymentMethod] : '—'),
    },
    {
      key: 'date',
      header: 'تاریخ',
      render: (p) => formatDate(p.paidAt),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      align: 'left',
      cellClassName: 'tabular font-medium text-paid',
      render: (p) => formatToman(p.amount),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="داشبورد" description="نمای کلی وضعیت مالی مدرسه" />

      {error && (
        <div className="mb-4 rounded-lg bg-overdue/10 px-4 py-3 text-sm text-overdue">
          خطا در بارگذاری اطلاعات داشبورد
        </div>
      )}

      {/* Statistics cards */}
      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="جمع شهریه (تخمینی)" value={formatToman(totalDue)} icon={<TuitionIcon />} />
          <StatCard
            label="پرداخت‌شده این ماه"
            value={formatToman(paidThisMonth)}
            accent="paid"
            icon={<CheckIcon />}
          />
          <StatCard
            label="باقی‌مانده کل"
            value={formatToman(totalOutstanding)}
            accent="overdue"
            icon={<AlertIcon />}
          />
        </div>
      )}

      {/* KPI + Payment Summary */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {loading ? (
            <Card>
              <div className="skeleton mb-3 h-4 w-28" />
              <div className="skeleton mb-4 h-8 w-20" />
              <div className="skeleton h-1.5 w-full" />
            </Card>
          ) : (
            <KPICard
              label="نرخ وصول این ماه"
              value={`${toPersianDigits(Math.round(collectionRate))}٪`}
              icon={<TargetIcon />}
              accent="action"
              progress={collectionRate}
              subtitle={`از ${formatToman(totalDue)} شهریه این ماه`}
            />
          )}
        </div>

        <Card title="خلاصه پرداخت‌ها" className="lg:col-span-2">
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            {loading ? (
              <SkeletonRows rows={3} cols={1} />
            ) : (
              <div dir="ltr" className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatToman(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div dir="rtl" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] text-ink/45 dark:text-paper/45">جمع کل</span>
                  <span className="tabular text-sm font-bold text-ink dark:text-paper">{formatToman(totalDue)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <LegendRow color="bg-paid" label="پرداخت‌شده (این ماه)" value={loading ? '—' : formatToman(paidThisMonth)} />
              <LegendRow color="bg-overdue" label="باقی‌مانده" value={loading ? '—' : formatToman(totalOutstanding)} />
            </div>
          </div>
        </Card>
      </div>

      <FinancialTrendPanel />

      {/* Analytics cards — overdue breakdown */}
      <div className="mt-6">
        <SectionHeader
          title="اقساط معوق"
          action={
            <Link to="/reports" className="text-xs font-medium text-action hover:underline">
              مشاهده گزارش کامل ←
            </Link>
          }
        />
        {loading ? (
          <SkeletonCards count={3} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="تعداد اقساط معوق"
              value={summary ? toPersianDigits(summary.overdueInstallmentCount) : '—'}
              icon={<ListIcon />}
            />
            <StatCard
              label="دانش‌آموزان بدهکار"
              value={summary ? toPersianDigits(summary.overdueStudentCount) : '—'}
              icon={<UsersIcon />}
            />
            <StatCard
              label="مبلغ معوق"
              value={summary ? formatToman(summary.totalOverdueAmount) : '—'}
              accent="overdue"
              icon={<AlertIcon />}
            />
          </div>
        )}
      </div>

      {/* Debtor students + recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="دانش‌آموزان بدهکار (بیشترین مانده)">
          <Table
            columns={debtorColumns}
            data={topDebtors}
            rowKey={(d) => d.studentId}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هیچ دانش‌آموز بدهکاری وجود ندارد."
          />
          {debtors.length > 5 && (
            <Link to="/reports" className="mt-3 inline-block text-xs font-medium text-action hover:underline">
              مشاهده همه {toPersianDigits(debtors.length)} مورد ←
            </Link>
          )}
        </Card>

        <Card title="آخرین فعالیت‌ها (پرداخت‌ها)">
          <Table
            columns={activityColumns}
            data={latestPayments}
            rowKey={(p) => p.id}
            loading={loading}
            skeletonRows={5}
            emptyMessage="هنوز پرداختی ثبت نشده است."
          />
        </Card>
      </div>
    </div>
  );
}

// Same technique ReportsPage's IncomeTrendPanel already uses: the backend
// only exposes GET /reports/monthly-income?year&month (one aggregate per
// call, no series endpoint — see report.types.ts), so the trend is built
// by calling it once per month via the existing useMonthlyIncomeTrend
// hook. No new endpoint, no "target" line — there's no backend concept of
// a target to compare against, so this only adds a previous-month delta,
// which is derivable from the same six data points already being fetched.
function FinancialTrendPanel() {
  const months = useMemo(() => {
    const now = new Date();
    const result: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return result;
  }, []);

  const results = useMonthlyIncomeTrend(months);
  const loading = results.some((r) => r.isLoading);
  const points = results.map((r, i) => ({
    ...(r.data ?? { year: months[i].year, month: months[i].month, totalIncome: 0, paymentCount: 0 }),
    label: `${persianMonthNames[months[i].month - 1]} ${months[i].year}`,
  }));

  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const hasComparison = !loading && !!current && !!previous && previous.totalIncome > 0;
  const changePct = hasComparison ? ((current.totalIncome - previous.totalIncome) / previous.totalIncome) * 100 : null;

  return (
    <Card
      title="روند درآمد (۶ ماه اخیر)"
      className="mt-6"
      action={
        changePct !== null ? (
          <span
            className={`tabular text-xs font-semibold ${changePct >= 0 ? 'text-paid' : 'text-overdue'}`}
            title="نسبت به ماه قبل"
          >
            {changePct >= 0 ? '▲' : '▼'} {toPersianDigits(Math.abs(Math.round(changePct)))}٪ نسبت به ماه قبل
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonRows rows={3} cols={4} />
      ) : (
        <div dir="ltr" className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={12} tickFormatter={(v) => toPersianDigits(String(v))} />
              <Tooltip formatter={(value: number) => formatToman(value)} />
              <Line type="monotone" dataKey="totalIncome" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5 dark:bg-white/5">
      <span className="flex items-center gap-2 text-sm text-ink/70 dark:text-paper/70">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        {label}
      </span>
      <span className="tabular text-sm font-semibold text-ink dark:text-paper">{value}</span>
    </div>
  );
}


