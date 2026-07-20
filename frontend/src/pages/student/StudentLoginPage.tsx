import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/error-handler';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ParentAuthShell } from '../../components/ParentAuthShell';

// Dedicated login route/experience for students (/student/login), same
// "separate portal, shared shell" shape as ParentLoginPage/TeacherLoginPage.
//
// Unlike every other portal, this form collects a username rather than a
// phone number — student-role logins authenticate via `username` on the
// backend (see LoginDto/AuthService), never `phone`. useAuth().loginWithUsername()
// carries that through without touching the existing phone-based
// login() used by every other login page.
//
// No "forgot password" link here (unlike Parent/Teacher) — the backend's
// forgot-password flow (ForgotPasswordDto/ResetPasswordDto) is phone-based
// SMS recovery, and a username-only login has no phone to send a code to.
// Reusing that link here would point at a flow that can't actually work
// for this role.
export function StudentLoginPage() {
  const { loginWithUsername, user, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameError = touched && !username ? 'نام کاربری را وارد کنید' : undefined;
  const passwordError = touched && !password ? 'رمز عبور را وارد کنید' : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (!username || !password) return;

    setLoading(true);
    try {
      await loginWithUsername(username, password);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  // Same "role check happens right after user updates" shape as
  // ParentLoginPage/TeacherLoginPage.
  if (user && !error) {
    if (user.role !== 'student') {
      // Same login endpoint serves every role — someone who mistakenly
      // lands on the student login is signed back out rather than
      // silently landing on a portal meant for students.
      logout();
      return null;
    }
    navigate('/student/dashboard', { replace: true });
    return null;
  }

  return (
    <ParentAuthShell
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
          <path d="M6 9.75V15c0 1.5 2.7 3 6 3s6-1.5 6-3V9.75" />
        </svg>
      }
      title="پنل دانش‌آموزان"
      subtitle="مشاهده کارنامه، تکالیف و برنامه هفتگی"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="نام کاربری"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={usernameError}
          containerClassName="mb-4"
          required
        />

        <Input
          label="رمز عبور"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          containerClassName="mb-4"
          required
        />

        {error && (
          <div className="mb-4 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue" role="alert">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          ورود
        </Button>
      </form>
    </ParentAuthShell>
  );
}
