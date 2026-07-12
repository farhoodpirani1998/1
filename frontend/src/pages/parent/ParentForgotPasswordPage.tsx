import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ParentAuthShell } from '../../components/ParentAuthShell';
import { useRequestPasswordReset } from '../../hooks/usePasswordReset';

// /parent/forgot-password — isolated from ParentLoginPage's own
// "forgot password" click (now a real link, see that file) so this page
// can carry its own idle/loading/success/error states without crowding
// the login form. Backed by a mock service (see
// api/parentPasswordReset.mock.ts) until a real endpoint exists.
export function ParentForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const resetMutation = useRequestPasswordReset();

  const phoneError = touched && !phone ? 'شماره تلفن را وارد کنید' : undefined;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!phone) return;
    resetMutation.mutate({ phone });
  }

  // Once the mock (or, later, the real endpoint) resolves successfully,
  // show a confirmation state instead of the form — same "success state
  // replaces the form" pattern used for other one-shot actions in this
  // app rather than a transient toast, since this message needs to stay
  // on screen for the parent to read.

  return (
    <ParentAuthShell
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      }
      title="بازیابی رمز عبور"
      subtitle="شماره تلفن ثبت‌شده خود را وارد کنید"
    >
      {resetMutation.isSuccess && resetMutation.data.success ? (
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-paid-soft text-paid">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-ink">{resetMutation.data.message}</p>
          <Link to="/parent/login" className="btn-secondary inline-flex">
            بازگشت به صفحه ورود
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="mb-4 text-sm leading-relaxed text-ink/60">
            لینک بازیابی رمز عبور برای شماره تلفنی که وارد می‌کنید پیامک خواهد شد.
          </p>

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
            autoFocus
          />

          {resetMutation.isError && (
            <div className="mb-4 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue" role="alert">
              {resetMutation.error instanceof Error
                ? resetMutation.error.message
                : 'ارسال درخواست با خطا مواجه شد. دوباره تلاش کنید.'}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={resetMutation.isPending}>
            ارسال لینک بازیابی
          </Button>

          <Link
            to="/parent/login"
            className="mt-4 block text-center text-xs font-medium text-action hover:underline"
          >
            بازگشت به صفحه ورود
          </Link>
        </form>
      )}
    </ParentAuthShell>
  );
}
