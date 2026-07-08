import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { DashboardPage } from '../pages/DashboardPage';

export function HomeRedirect() {
  const { user } = useAuth();

  if (user?.role === 'super_admin') {
    return <Navigate to="/schools" replace />;
  }

  return <DashboardPage />;
}
