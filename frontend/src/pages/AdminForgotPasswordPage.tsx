import { ForgotPasswordFlow } from '../components/ForgotPasswordFlow';

// /forgot-password — thin wrapper around the shared ForgotPasswordFlow
// (see that file), used by every non-teacher/non-parent role that logs
// in through LoginPage (school_admin, accountant, staff, super_admin,
// founder) — they all share one POST /auth/login, so they share this
// reset flow too.
export function AdminForgotPasswordPage() {
  return <ForgotPasswordFlow loginPath="/login" />;
}
