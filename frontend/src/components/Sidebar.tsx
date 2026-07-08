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
  { to: '/schools', label: 'مدارس', icon: SchoolsIcon, roles: ['super_admin'] },
  { to: '/users', label: 'کاربران', icon: UsersIcon, roles: ['super_admin'] },
];

export function Sidebar() {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="flex h-screen w-64 flex-col border-l border-line bg-navy text-white">
      <div className="px-6 py-6">
        <div className="text-lg font-bold">دفتر مدرسه</div>
        <div className="mt-0.5 text-xs text-white/60">پنل مدیریت</div>
      </div>

      <nav className="flex-1 px-3">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* active-tab: a small bookmark-like tab marking the active page */}
                {isActive && (
                  <span className="absolute -right-3 top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-accent" />
                )}
                <Icon />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-6 py-4 text-xs text-white/50">
        نسخه ۰.۲ — در حال توسعه
      </div>
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


