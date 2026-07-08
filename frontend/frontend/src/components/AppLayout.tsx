import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../lib/auth';

export function AppLayout() {
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-paper dark:bg-[#0a1120]">
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
