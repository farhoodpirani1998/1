import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getErrorMessage } from '../lib/error-handler';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(phone, password);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <img src="/logo-icon.png" alt="ندای حقیقت" className="h-14 w-14 object-contain" />
          </div>
          <div className="text-2xl font-bold">ندای حقیقت</div>
          <div className="mt-1 text-sm text-white/60">ورود به پنل مدیریت</div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-card">
          <label className="mb-1.5 block text-sm font-medium text-ink">شماره تلفن</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-action"
            placeholder="۰۹۱۲xxxxxxx"
          />

          <label className="mb-1.5 block text-sm font-medium text-ink">رمز عبور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-action"
          />

          {error && <div className="mb-4 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-action py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>

          <Link
            to="/forgot-password"
            className="mt-4 block text-center text-xs font-medium text-action hover:underline"
          >
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </form>
      </div>
    </div>
  );
}
