import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';

const roleLabels: Record<string, string> = {
  super_admin: 'مدیر کل',
  school_admin: 'مدیر مدرسه',
  accountant: 'حسابدار',
  staff: 'کارمند',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="rounded-lg p-1.5 text-ink/70 hover:bg-paper lg:hidden dark:text-paper/70 dark:hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="hidden text-sm text-ink/60 sm:block dark:text-paper/60">
          {new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          title={isDark ? 'حالت روشن' : 'حالت تاریک'}
          className="rounded-lg p-1.5 text-ink/70 hover:bg-paper dark:text-paper/70 dark:hover:bg-white/10"
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
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium text-ink dark:text-paper">{user.fullName}</div>
            <div className="text-xs text-ink/50 dark:text-paper/50">{roleLabels[user.role] ?? user.role}</div>
          </div>
        )}
        <button
          onClick={logout}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink/70 transition-colors hover:bg-paper dark:border-white/15 dark:text-paper/70 dark:hover:bg-white/10"
        >
          خروج
        </button>
      </div>
    </header>
  );
}
