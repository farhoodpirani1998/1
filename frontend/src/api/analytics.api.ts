import { api } from '../lib/api';
import type { DashboardView } from '../types/analytics.types';

// GET /analytics/dashboard is @Roles('school_admin') only — narrower
// than /reports/* (school_admin + accountant). Only call this for
// school_admin users; accountant/staff get a 403.
export function getDashboard() {
  return api.get<DashboardView>('/analytics/dashboard');
}
