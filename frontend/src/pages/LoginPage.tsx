import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getErrorMessage } from '../lib/error-handler';

// Decorative rings that echo the arc in the school's own logo mark —
// same motif, just built in CSS so it can scale to fill the panel
// instead of being baked into a raster image.
function BrandRings() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/[0.14]" />
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/[0.18]" />
      <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/[0.22]" />
    </div>
  );
}

function StarAccent({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
    </svg>
  );
}

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — the school's identity gets real room to breathe here,
          instead of a small badge above a generic card. Stacks above the
          form on mobile instead of disappearing. */}
      <div className="relative flex items-center justify-center overflow-hidden bg-navy px-6 py-14 lg:min-h-screen lg:w-[46%] lg:py-0">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 38%, rgba(201,162,39,0.16), transparent 70%), linear-gradient(180deg, #0F172A 0%, #020617 100%)',
          }}
        />
        <BrandRings />
        <StarAccent className="absolute right-[18%] top-[22%] h-3 w-3 text-gold/40" />
        <StarAccent className="absolute left-[16%] top-[62%] h-2 w-2 text-gold/30" />
        <StarAccent className="absolute right-[28%] top-[70%] h-2.5 w-2.5 text-gold-light/30" />

        <div className="relative text-center text-white">
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <div className="brand-glow absolute inset-0 rounded-full bg-gold/25 blur-2xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
              <img src="/logo-icon.png" alt="ندای حقیقت" className="h-16 w-16 object-contain" />
            </div>
          </div>

          <div className="text-3xl font-bold">ندای حقیقت</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Nedaye Haghighat Educational Group
          </div>

          <div className="mx-auto my-6 flex w-40 items-center gap-2 text-gold/50">
            <span className="h-px flex-1 bg-current" />
            <StarAccent className="h-3 w-3" />
            <span className="h-px flex-1 bg-current" />
          </div>

          <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-white/60">
            آینده‌ای روشن، با آموزش ماندگار
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-paper px-4 py-12 dark:bg-navy-dark">
        <div className="w-full max-w-sm">
          <div className="mb-7">
            <div className="text-xs font-medium text-action">پنل مدیریت</div>
            <h1 className="mt-1 text-2xl font-bold text-ink dark:text-paper">خوش آمدید</h1>
            <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">
              برای ادامه، وارد حساب کاربری خود شوید
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-card dark:bg-white/[0.03] dark:ring-1 dark:ring-white/10">
            <label className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">شماره تلفن</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="input mb-4"
              placeholder="۰۹۱۲xxxxxxx"
            />

            <label className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">رمز عبور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input mb-4"
            />

            {error && <div className="mb-4 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
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
    </div>
  );
}
