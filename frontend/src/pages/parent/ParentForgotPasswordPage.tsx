import { ForgotPasswordFlow } from '../../components/ForgotPasswordFlow';

// /parent/forgot-password — thin wrapper around the shared
// ForgotPasswordFlow (see that file), pointing its "back to login" links
// at the parent login page.
export function ParentForgotPasswordPage() {
  return <ForgotPasswordFlow loginPath="/parent/login" />;
}
