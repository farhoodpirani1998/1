import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/error-handler';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ParentAuthShell } from '../../components/ParentAuthShell';

// Dedicated login route/experience for teachers (/teacher/login), same
// "separate portal, shared auth" shape as ParentLoginPage: it reuses
// useAuth().login() (POST /auth/login), the Input/Button components, and
// error-handling utilities rather than duplicating any of that logic.
//
// ParentAuthShell is reused as-is despite its name — it's a generic
// icon/title/subtitle/card shell with no parent-specific logic (see that
// component), and duplicating it as "TeacherAuthShell" would be exactly
// the kind of unnecessary duplication this sprint's brief calls out.
export function TeacherLoginPage() {
  const { login, user, logout } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneError = touched && !phone ? 'شماره تلفن را وارد کنید' : undefined;
  const passwordError = touched && !password ? 'رمز عبور را وارد کنید' : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (!phone || !password) return;

    setLoading(true);
    try {
      await login(phone, password);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  // login() resolves before AuthProvider's state update is guaranteed to
  // have flushed to this render, so the role check happens here, right
  // after `user` updates, rather than immediately after awaiting login()
  // — same shape as ParentLoginPage.
  if (user && !error) {
    if (user.role !== 'teacher') {
      // Same phone+password endpoint serves every role — a non-teacher
      // who mistakenly lands on the teacher login is signed back out
      // rather than silently landing on a portal meant for teachers.
      logout();
      return null;
    }
    navigate('/teacher/dashboard', { replace: true });
    return null;
  }

  return (
    <ParentAuthShell
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M4 6.5 12 3l8 3.5-8 3.5-8-3.5Z" />
          <path d="M7 9.5V15c0 1.5 2.5 3 5 3s5-1.5 5-3V9.5" />
        </svg>
      }
      title="پنل معلمان"
      subtitle="مدیریت کلاس‌ها و دروس تخصیص‌یافته"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="شماره تلفن"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneError}
          placeholder="۰۹۱۲xxxxxxx"
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
