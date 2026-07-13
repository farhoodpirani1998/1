import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';

const roleLabels: Record<string, string> = {
  super_admin: 'مدیر کل',
  school_admin: 'مدیر مدرسه',
  accountant: 'حسابدار',
  staff: 'کارمند',
  parent: 'والد',
  teacher: 'معلم',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-navy-dark/85">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-ink/70 transition-colors hover:bg-paper lg:hidden dark:text-paper/70 dark:hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="hidden text-sm text-ink/55 sm:block dark:text-paper/55">
          {new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggle}
          title={isDark ? 'حالت روشن' : 'حالت تاریک'}
          className="rounded-lg p-1.5 text-ink/70 transition-colors hover:bg-paper dark:text-paper/70 dark:hover:bg-white/10"
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12.5A8.5 8.5 0 1 1 11.5 3 7 7 0 0 0 21 12.5Z" />
            </svg>
          )}
        </button>

        {user && (
          <div className="hidden items-center gap-2.5 rounded-lg border border-line py-1 pl-1 pr-3 sm:flex dark:border-white/10">
            <div className="text-left">
              <div className="text-sm font-medium leading-tight text-ink dark:text-paper">{user.fullName}</div>
              <div className="text-[11px] leading-tight text-ink/45 dark:text-paper/45">
                {roleLabels[user.role] ?? user.role}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-action-soft text-xs font-semibold text-action dark:bg-action/15 dark:text-action-light">
              {user.fullName?.charAt(0) ?? '?'}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink/70 transition-colors hover:border-overdue/30 hover:bg-overdue/5 hover:text-overdue dark:border-white/15 dark:text-paper/70"
        >
          خروج
        </button>
      </div>
    </header>
  );
}
