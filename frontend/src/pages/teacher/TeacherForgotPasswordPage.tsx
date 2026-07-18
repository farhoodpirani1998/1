import { ForgotPasswordFlow } from '../../components/ForgotPasswordFlow';

// /teacher/forgot-password — thin wrapper around the shared
// ForgotPasswordFlow (see that file), pointing its "back to login" links
// at the teacher login page.
export function TeacherForgotPasswordPage() {
  return <ForgotPasswordFlow loginPath="/teacher/login" />;
}
