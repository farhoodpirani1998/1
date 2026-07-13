import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../types/auth.types';

interface NavItem {
  to: string;
  label: string;
  icon: () => JSX.Element;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'داشبورد', icon: DashboardIcon, roles: ['school_admin', 'accountant', 'staff'] },
  { to: '/students', label: 'دانش‌آموزان', icon: StudentsIcon, roles: ['school_admin', 'accountant', 'staff'] },
  { to: '/installments', label: 'اقساط و پرداخت‌ها', icon: InstallmentsIcon, roles: ['school_admin', 'accountant'] },
  { to: '/reports', label: 'گزارش‌ها', icon: ReportsIcon, roles: ['school_admin', 'accountant'] },
  { to: '/settings', label: 'تنظیمات', icon: SettingsIcon, roles: ['school_admin'] },
  // Sprint 2A: Teacher Assignments admin page (school_admin-only).
  { to: '/teacher-assignments', label: 'تخصیص معلمان', icon: AssignmentsIcon, roles: ['school_admin'] },
  { to: '/schools', label: 'مدارس', icon: SchoolsIcon, roles: ['super_admin'] },
  { to: '/users', label: 'کاربران', icon: UsersIcon, roles: ['super_admin'] },

  // Parent portal — only ever visible to a signed-in parent, on the
  // separate /parent/* route group (see App.tsx).
  { to: '/parent/dashboard', label: 'داشبورد', icon: DashboardIcon, roles: ['parent'] },
  { to: '/parent/tuition', label: 'وضعیت شهریه', icon: TuitionIcon, roles: ['parent'] },
  { to: '/parent/installments', label: 'اقساط', icon: InstallmentsIcon, roles: ['parent'] },
  { to: '/parent/payments', label: 'تاریخچه پرداخت‌ها', icon: PaymentsIcon, roles: ['parent'] },

  // Teacher portal (Sprint 1) — only ever visible to a signed-in teacher,
  // on the separate /teacher/* route group (see App.tsx). Only Dashboard
  // is a real page this sprint; the rest point at a shared placeholder
  // page (TeacherComingSoonPage) until the sprints that build them.
  { to: '/teacher/dashboard', label: 'داشبورد', icon: DashboardIcon, roles: ['teacher'] },
  { to: '/teacher/students', label: 'دانش‌آموزان', icon: StudentsIcon, roles: ['teacher'] },
  { to: '/teacher/attendance', label: 'حضور و غیاب', icon: InstallmentsIcon, roles: ['teacher'] },
  { to: '/teacher/assessments', label: 'ارزیابی‌ها', icon: TuitionIcon, roles: ['teacher'] },
  { to: '/teacher/homework', label: 'تکالیف', icon: ReportsIcon, roles: ['teacher'] },
  { to: '/teacher/timetable', label: 'برنامه هفتگی', icon: PaymentsIcon, roles: ['teacher'] },
  { to: '/teacher/announcements', label: 'اطلاعیه‌ها', icon: SettingsIcon, roles: ['teacher'] },
];

const roleLabels: Record<string, string> = {
  super_admin: 'مدیر کل',
  school_admin: 'مدیر مدرسه',
  accountant: 'حسابدار',
  staff: 'کارمند',
  parent: 'والد',
  teacher: 'معلم',
};

export function Sidebar() {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => user && item.roles.includes(user.role));
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  return (
    <aside className="flex h-screen w-64 flex-col border-l border-white/[0.06] bg-navy text-white">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-action shadow-[0_2px_8px_rgba(37,99,235,0.45)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-bold leading-tight">
            {isParent ? 'پنل والدین' : isTeacher ? 'پنل معلمان' : 'دفتر مدرسه'}
          </div>
          <div className="mt-0.5 text-[11px] text-white/45">
            {isParent ? 'وضعیت شهریه فرزندان' : isTeacher ? 'مدیریت کلاس‌های درسی' : 'پنل مدیریت مالی'}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-action/15 font-medium text-white'
                  : 'text-white/55 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-action-light" />
                )}
                <span className={isActive ? 'text-action-light' : 'text-white/40 group-hover:text-white/70'}>
                  <Icon />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
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

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function InstallmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 14h3" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.3 2.5a8 8 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.97 7.97 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1L11 21h4l.3-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z" />
    </svg>
  );
}

function SchoolsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6" />
    </svg>
  );
}

function TuitionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.5-2.2s2.5.8 2.5 2c0 1.4-1.2 1.8-2.5 2.2-1.3.4-2.5.8-2.5 2.2 0 1.2 1.2 2 2.5 2s2.5-.8 2.5-2.2" />
    </svg>
  );
}

function PaymentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
}

function AssignmentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 14c2.5.3 4.5 2.3 4.5 4.8" />
    </svg>
  );
}
