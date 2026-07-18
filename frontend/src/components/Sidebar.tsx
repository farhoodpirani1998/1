import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
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
  type IconProps,
} from './icons/SchoolIcons';

interface NavItem {
  to: string;
  label: string;
  icon: (props: IconProps) => ReactElement;
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

  // Founder portal — only ever visible to a signed-in founder. Unlike the
  // parent/teacher item lists above, the per-school pages
  // (dashboard/students/teachers/staff/tuition) aren't listed here since
  // their routes carry a :schoolId (/founder/schools/:schoolId/...) that
  // this static nav list can't express — those live in FounderSchoolLayout's
  // own in-page tab bar instead (see pages/founder/FounderSchoolLayout.tsx).
  { to: '/founder/overview', label: 'نمای کلی', icon: SchoolsIcon, roles: ['founder'] },
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

export function Sidebar() {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => user && item.roles.includes(user.role));
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';
  const isFounder = user?.role === 'founder';

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
            {isParent ? 'پنل والدین' : isTeacher ? 'پنل معلمان' : isFounder ? 'پنل مؤسسان' : 'دفتر مدرسه'}
          </div>
          <div className="mt-0.5 text-[11px] text-white/45">
            {isParent
              ? 'وضعیت شهریه فرزندان'
              : isTeacher
                ? 'مدیریت کلاس‌های درسی'
                : isFounder
                  ? 'نمای کلی چند مدرسه'
                  : 'پنل مدیریت مالی'}
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

