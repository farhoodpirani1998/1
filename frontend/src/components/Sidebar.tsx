import { useMemo, useState, type ReactElement } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSchoolSettings } from '../hooks/useSchoolSettings';
import type { UserRole } from '../types/auth.types';
import {
  DashboardIcon,
  StudentsIcon,
  InstallmentsIcon,
  ReportsIcon,
  SettingsIcon,
  SchoolsIcon,
  TuitionIcon,
  PaymentsIcon,
  AssignmentsIcon,
  UsersIcon,
  CalendarIcon,
  AttendanceIcon,
  ListIcon,
  ClassIcon,
  ScoreIcon,
  TargetIcon,
  TeacherIcon,
  BalanceIcon,
  NotificationIcon,
  MessageIcon,
  HistoryIcon,
  ChevronDownIcon,
  LockIcon,
  type IconProps,
} from './icons/SchoolIcons';

type Icon = (props: IconProps) => ReactElement;

interface NavLeaf {
  /** Route path. Omitted for items whose page doesn't exist yet — they
   * render as a disabled "coming soon" row instead of a link (Sprint 1
   * requirement: don't remove/rename existing pages, but don't invent
   * new ones either — just reserve their spot in the new IA). */
  to?: string;
  label: string;
  icon: Icon;
  roles: UserRole[];
  /** Exact-match routes only (e.g. "/"). */
  end?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: Icon;
  items: NavLeaf[];
}

// ---------------------------------------------------------------------
// School Admin Portal (super_admin / school_admin / accountant / staff)
// ---------------------------------------------------------------------
// Sprint 1: navigation + information architecture only. Every `to` below
// is an existing, untouched route from App.tsx — none were added, moved,
// or removed. Items without a `to` have no corresponding page yet and
// render as disabled placeholders per the sprint spec.

const dashboardItem: NavLeaf = {
  to: '/',
  label: 'داشبورد',
  icon: DashboardIcon,
  roles: ['school_admin', 'accountant', 'staff'],
  end: true,
};

const adminGroups: NavGroup[] = [
  {
    id: 'academic',
    label: 'آموزشی',
    icon: ClassIcon,
    items: [
      { to: '/students', label: 'دانش‌آموزان', icon: StudentsIcon, roles: ['school_admin', 'accountant', 'staff'] },
      { label: 'کلاس‌ها', icon: ClassIcon, roles: ['school_admin'] },
      { label: 'پایه‌های تحصیلی', icon: ScoreIcon, roles: ['school_admin'] },
      { to: '/timetable', label: 'برنامه هفتگی', icon: CalendarIcon, roles: ['school_admin'] },
      { to: '/attendance', label: 'حضور و غیاب', icon: AttendanceIcon, roles: ['school_admin', 'accountant', 'staff'] },
      { label: 'ارزیابی‌ها', icon: TargetIcon, roles: ['school_admin'] },
    ],
  },
  {
    id: 'people',
    label: 'افراد',
    icon: UsersIcon,
    items: [
      // Sprint 2A's Teacher Assignments page is the existing admin-side
      // teacher management screen — kept exactly as-is, just relabeled
      // to match the new IA's "People > Teachers" slot.
      { to: '/teacher-assignments', label: 'معلمان', icon: TeacherIcon, roles: ['school_admin'] },
      { to: '/guardians', label: 'والدین', icon: UsersIcon, roles: ['school_admin', 'accountant', 'staff'] },
      { to: '/users', label: 'کاربران', icon: UsersIcon, roles: ['super_admin'] },
      { label: 'نقش‌ها', icon: TargetIcon, roles: ['super_admin'] },
    ],
  },
  {
    id: 'finance',
    label: 'مالی',
    icon: TuitionIcon,
    items: [
      { label: 'شهریه', icon: TuitionIcon, roles: ['school_admin', 'accountant'] },
      { label: 'پرداخت‌ها', icon: PaymentsIcon, roles: ['school_admin', 'accountant'] },
      { to: '/installments', label: 'اقساط', icon: InstallmentsIcon, roles: ['school_admin', 'accountant'] },
      { label: 'تخفیف‌ها', icon: BalanceIcon, roles: ['school_admin', 'accountant'] },
    ],
  },
  {
    id: 'admissions',
    label: 'پذیرش',
    icon: AssignmentsIcon,
    items: [
      { label: 'پیش‌ثبت‌نام', icon: AssignmentsIcon, roles: ['school_admin', 'staff'] },
      { label: 'ثبت‌نام', icon: ListIcon, roles: ['school_admin', 'staff'] },
    ],
  },
  {
    id: 'communication',
    label: 'ارتباطات',
    icon: MessageIcon,
    items: [
      { label: 'اطلاعیه‌ها', icon: NotificationIcon, roles: ['school_admin', 'staff'] },
      { label: 'پیام‌ها', icon: MessageIcon, roles: ['school_admin', 'staff'] },
      { label: 'رویدادها', icon: CalendarIcon, roles: ['school_admin', 'staff'] },
    ],
  },
  {
    id: 'reports',
    label: 'گزارش‌ها',
    icon: ReportsIcon,
    items: [
      { label: 'گزارش‌های آموزشی', icon: ScoreIcon, roles: ['school_admin', 'accountant'] },
      { to: '/reports', label: 'گزارش‌های مالی', icon: ReportsIcon, roles: ['school_admin', 'accountant'] },
      { label: 'گزارش‌های حضور و غیاب', icon: AttendanceIcon, roles: ['school_admin', 'accountant'] },
      { label: 'عملکرد معلمان', icon: TeacherIcon, roles: ['school_admin', 'accountant'] },
    ],
  },
  {
    id: 'administration',
    label: 'مدیریت سیستم',
    icon: SettingsIcon,
    items: [
      // Academic year + school settings both live on the one existing
      // /settings page today (see SettingsPage.tsx) — surfaced as two
      // nav entries since the sprint scope is navigation/IA only and
      // can't split that page into separate routes.
      { to: '/settings', label: 'سال تحصیلی', icon: CalendarIcon, roles: ['school_admin'] },
      { to: '/settings', label: 'تنظیمات مدرسه', icon: SettingsIcon, roles: ['school_admin'] },
      { to: '/schools', label: 'مدارس', icon: SchoolsIcon, roles: ['super_admin'] },
      { label: 'گزارش تغییرات', icon: HistoryIcon, roles: ['super_admin'] },
      { label: 'وضعیت سیستم', icon: TargetIcon, roles: ['super_admin'] },
    ],
  },
];

// ---------------------------------------------------------------------
// Parent / Teacher / Founder portals — unchanged flat nav lists.
// Out of scope for this sprint (Teacher Portal already shipped; Parent
// and Founder portals aren't part of the School Admin Portal redesign).
// ---------------------------------------------------------------------

const parentNavItems: NavLeaf[] = [
  { to: '/parent/dashboard', label: 'داشبورد', icon: DashboardIcon, roles: ['parent'] },
  { to: '/parent/tuition', label: 'وضعیت شهریه', icon: TuitionIcon, roles: ['parent'] },
  { to: '/parent/installments', label: 'اقساط', icon: InstallmentsIcon, roles: ['parent'] },
  { to: '/parent/payments', label: 'تاریخچه پرداخت‌ها', icon: PaymentsIcon, roles: ['parent'] },
  { to: '/parent/report-card', label: 'کارنامه', icon: ReportsIcon, roles: ['parent'] },
  { to: '/parent/attendance', label: 'حضور و غیاب', icon: AttendanceIcon, roles: ['parent'] },
  { to: '/parent/homework', label: 'تکالیف', icon: AssignmentsIcon, roles: ['parent'] },
  { to: '/parent/timetable', label: 'برنامه هفتگی', icon: CalendarIcon, roles: ['parent'] },
  { to: '/parent/documents', label: 'مدارک', icon: ListIcon, roles: ['parent'] },
  { to: '/parent/announcements', label: 'اطلاعیه‌ها', icon: SettingsIcon, roles: ['parent'] },
];

const teacherNavItems: NavLeaf[] = [
  { to: '/teacher/dashboard', label: 'داشبورد', icon: DashboardIcon, roles: ['teacher'] },
  { to: '/teacher/students', label: 'دانش‌آموزان', icon: StudentsIcon, roles: ['teacher'] },
  { to: '/teacher/attendance', label: 'حضور و غیاب', icon: InstallmentsIcon, roles: ['teacher'] },
  { to: '/teacher/assessments', label: 'ارزیابی‌ها', icon: TuitionIcon, roles: ['teacher'] },
  { to: '/teacher/homework', label: 'تکالیف', icon: ReportsIcon, roles: ['teacher'] },
  { to: '/teacher/timetable', label: 'برنامه هفتگی', icon: PaymentsIcon, roles: ['teacher'] },
  { to: '/teacher/announcements', label: 'اطلاعیه‌ها', icon: SettingsIcon, roles: ['teacher'] },
];

const founderNavItems: NavLeaf[] = [
  { to: '/founder/overview', label: 'نمای کلی', icon: SchoolsIcon, roles: ['founder'] },
  { to: '/founder/teachers', label: 'معلمان', icon: StudentsIcon, roles: ['founder'] },
];

const roleLabels: Record<string, string> = {
  super_admin: 'مدیر کل',
  school_admin: 'مدیر مدرسه',
  accountant: 'حسابدار',
  staff: 'کارمند',
  parent: 'والد',
  teacher: 'معلم',
  founder: 'مؤسس',
};

const COLLAPSED_GROUPS_STORAGE_KEY = 'admin-sidebar-collapsed-groups';
const ADMIN_ROLES: UserRole[] = ['super_admin', 'school_admin', 'accountant', 'staff'];

function isPathActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function NavRow({ item, onNavigate, active }: { item: NavLeaf; onNavigate?: () => void; active: boolean }) {
  const Icon = item.icon;

  if (!item.to) {
    return (
      <div
        title="این بخش هنوز آماده نشده است"
        aria-disabled="true"
        className="group relative flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/25"
      >
        <span className="text-white/20">
          <Icon />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/35">
          <LockIcon size={11} />
          به‌زودی
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
        active ? 'bg-action/15 font-medium text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'
      }`}
    >
      {active && <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-action-light" />}
      <span className={active ? 'text-action-light' : 'text-white/40 group-hover:text-white/70'}>
        <Icon />
      </span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';
  const isFounder = user?.role === 'founder';
  const isAdminPortal = !!user && ADMIN_ROLES.includes(user.role);

  // GET /settings is school_admin-only on the backend — useSchoolSettings
  // already no-ops for every other role, so this is safe to call
  // unconditionally here.
  const settingsQuery = useSchoolSettings();
  const schoolLogoUrl = settingsQuery.data?.logoUrl;

  const visibleGroups = useMemo(
    () =>
      adminGroups
        .map((group) => ({ ...group, items: group.items.filter((item) => user && item.roles.includes(user.role)) }))
        .filter((group) => group.items.length > 0),
    [user],
  );

  const showDashboardItem = !!user && dashboardItem.roles.includes(user.role);

  // Groups default to open; a group is only closed once the user
  // explicitly collapses it, and that choice persists across visits.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // non-critical — collapse state just won't persist
      }
      return next;
    });
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-l border-white/[0.06] bg-navy text-white">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
          <img src="/logo-icon.png" alt="ندای حقیقت" className="h-8 w-8 object-contain" />
        </div>
        <div>
          <div className="text-[15px] font-bold leading-tight">ندای حقیقت</div>
          <div className="mt-0.5 text-[11px] text-white/45">
            {isParent
              ? 'پنل والدین'
              : isTeacher
                ? 'پنل معلمان'
                : isFounder
                  ? 'پنل مؤسسان'
                  : 'مجتمع آموزشی'}
          </div>
        </div>
      </div>

      {schoolLogoUrl && (
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-6 pb-4">
          {/* If the URL saved in settings 404s or fails to load, hide it
              instead of showing a broken-image icon in the nav. */}
          <img
            src={schoolLogoUrl}
            alt={settingsQuery.data?.schoolName ?? 'لوگوی مدرسه'}
            className="h-7 w-7 shrink-0 rounded-md bg-white/95 object-contain p-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {settingsQuery.data?.schoolName && (
            <div className="truncate text-xs font-medium text-white/60">{settingsQuery.data.schoolName}</div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {isAdminPortal ? (
          <div className="space-y-1">
            {showDashboardItem && (
              <div className="mb-2">
                <NavRow item={dashboardItem} onNavigate={onNavigate} active={isPathActive(pathname, '/', true)} />
              </div>
            )}

            {visibleGroups.map((group, idx) => {
              const isOpen = !collapsed[group.id];
              const GroupIcon = group.icon;
              const containsActive = group.items.some((item) => item.to && isPathActive(pathname, item.to, item.end));

              return (
                <div key={group.id} className={idx > 0 ? 'mt-1' : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-semibold tracking-wide transition-colors ${
                      containsActive ? 'text-white/80' : 'text-white/35 hover:text-white/60'
                    }`}
                  >
                    <span className={containsActive ? 'text-action-light' : 'text-white/30'}>
                      <GroupIcon size={15} />
                    </span>
                    <span className="flex-1 truncate text-right">{group.label}</span>
                    <span className={`shrink-0 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`}>
                      <ChevronDownIcon size={13} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-0.5 pb-1 pt-0.5">
                      {group.items.map((item, i) => (
                        <NavRow
                          key={item.to ?? `${group.id}-${i}`}
                          item={item}
                          onNavigate={onNavigate}
                          active={!!item.to && isPathActive(pathname, item.to, item.end)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-0.5">
            {(isParent ? parentNavItems : isTeacher ? teacherNavItems : isFounder ? founderNavItems : [])
              .filter((item) => user && item.roles.includes(user.role))
              .map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  onNavigate={onNavigate}
                  active={!!item.to && isPathActive(pathname, item.to, item.end)}
                />
              ))}
          </div>
        )}
      </nav>

      {user && (
        <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {user.fullName?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-white/85">{user.fullName}</div>
            <div className="truncate text-[11px] text-white/40">{roleLabels[user.role] ?? user.role}</div>
          </div>
        </div>
      )}
    </aside>
  );
}
