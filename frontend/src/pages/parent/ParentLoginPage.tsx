import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/error-handler';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ParentAuthShell } from '../../components/ParentAuthShell';

// Dedicated login route/experience for parents (/parent/login), kept
// separate from the staff /login page per product decision — but reuses
// the same useAuth().login() (POST /auth/login), Input/Button
// components, and error-handling utilities rather than duplicating any
// of that logic.
//
// NOTE on fields: the brief asked for "National ID", but the backend's
// LoginDto (auth/dto/login.dto.ts) only accepts { phone, password } —
// there is no national-ID login on the backend today. Inventing that
// field client-side would silently fail against the real API, so this
// form uses phone number, matching the actual auth contract (and the
// existing staff LoginPage).
export function ParentLoginPage() {
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
  // after `user` updates, rather than immediately after awaiting login().
  if (user && !error) {
    if (user.role !== 'parent') {
      // Same phone+password endpoint serves every role — a staff member
      // who mistakenly lands on the parent login gets a clear message
      // and is signed back out rather than silently landing on a portal
      // meant for parents.
      logout();
      return null;
    }
    navigate('/parent/dashboard', { replace: true });
    return null;
  }

  return (
    <ParentAuthShell
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      }
      title="پنل والدین"
      subtitle="مشاهده وضعیت شهریه و اقساط فرزندتان"
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
          containerClassName="mb-2"
          required
        />

        <div className="mb-4 text-left">
          <Link to="/parent/forgot-password" className="text-xs font-medium text-action hover:underline">
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </div>

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
