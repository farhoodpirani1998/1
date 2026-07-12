import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../lib/auth';

// loginPath defaults to '/login' so every existing call site (admin/
// accountant/staff routes) keeps its exact current behavior unchanged.
// The parent route group passes loginPath="/parent/login" so an
// unauthenticated visit to e.g. /parent/dashboard lands on the parent
// login page instead of the staff one.
export function AppLayout({ loginPath = '/login' }: { loginPath?: string }) {
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  return (
    <div className="flex min-h-screen bg-paper dark:bg-navy-dark">
      {/* mobile backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-30 transition-transform lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar />
      </div>

      <div className="min-w-0 flex-1">
        <Topbar onMenuClick={() => setMobileNavOpen((v) => !v)} />
        <main className="fade-in p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
