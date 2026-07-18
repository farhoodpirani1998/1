import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Input } from './Input';
import { Button } from './Button';
import { ParentAuthShell } from './ParentAuthShell';
import { useRequestPasswordReset, useConfirmPasswordReset } from '../hooks/usePasswordReset';
import { getErrorMessage } from '../lib/error-handler';

interface ForgotPasswordFlowProps {
  // Where "بازگشت به صفحه ورود" / the success-state link should point —
  // /login, /parent/login, or /teacher/login depending on which portal
  // this page is mounted under.
  loginPath: string;
}

const KeyIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
    <circle cx="8" cy="15" r="4" />
    <path d="M10.5 12.5 20 3M16 7l3 3M13 10l2 2" />
  </svg>
);

// Two-step self-service password reset, shared by every login portal
// (admin/staff via /login, teacher via /teacher/login, parent via
// /parent/login) since they all authenticate against the same POST
// /auth/login and the same `users` table.
//
// Step 1: enter phone -> POST /auth/forgot-password sends a 6-digit SMS
// code (always the same generic response, so this can't be used to
// probe which phone numbers are registered — see AuthService).
// Step 2: enter that code + a new password -> POST /auth/reset-password.
export function ForgotPasswordFlow({ loginPath }: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const requestMutation = useRequestPasswordReset();
  const confirmMutation = useConfirmPasswordReset();

  const phoneError = touched && !phone ? 'شماره تلفن را وارد کنید' : undefined;

  function handleRequestSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!phone) return;
    requestMutation.mutate(
      { phone },
      { onSuccess: () => setStep('confirm') },
    );
  }

  const codeError = touched && !code ? 'کد پیامک‌شده را وارد کنید' : undefined;
  const passwordError =
    touched && newPassword.length < 8 ? 'رمز عبور باید حداقل ۸ کاراکتر باشد' : undefined;
  const confirmError =
    touched && confirmPassword !== newPassword ? 'رمز عبور و تکرار آن یکسان نیستند' : undefined;

  function handleConfirmSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!code || newPassword.length < 8 || confirmPassword !== newPassword) return;
    confirmMutation.mutate(
      { phone, code, newPassword },
      { onSuccess: () => setStep('done') },
    );
  }

  return (
    <ParentAuthShell icon={KeyIcon} title="بازیابی رمز عبور" subtitle="بازیابی رمز عبور با کد پیامکی">
      {step === 'done' ? (
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-paid-soft text-paid">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-ink">
            رمز عبور شما با موفقیت تغییر کرد. اکنون می‌توانید با رمز جدید وارد شوید.
          </p>
          <Link to={loginPath} className="btn-secondary inline-flex">
            بازگشت به صفحه ورود
          </Link>
        </div>
      ) : step === 'confirm' ? (
        <form onSubmit={handleConfirmSubmit} noValidate>
          <p className="mb-4 text-sm leading-relaxed text-ink/60">
            کدی که برای شماره {phone} پیامک شد را همراه با رمز عبور جدید وارد کنید.
          </p>

          <Input
            label="کد تأیید"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={codeError}
            placeholder="۶ رقمی"
            containerClassName="mb-4"
            required
            autoFocus
          />

          <Input
            label="رمز عبور جدید"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordError}
            containerClassName="mb-4"
            required
          />

          <Input
            label="تکرار رمز عبور جدید"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmError}
            containerClassName="mb-4"
            required
          />

          {confirmMutation.isError && (
            <div className="mb-4 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue" role="alert">
              {getErrorMessage(confirmMutation.error)}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={confirmMutation.isPending}>
            تغییر رمز عبور
          </Button>

          <button
            type="button"
            onClick={() => setStep('request')}
            className="mt-4 block w-full text-center text-xs font-medium text-action hover:underline"
          >
            کد را دریافت نکردید؟ ارسال دوباره
          </button>
        </form>
      ) : (
        <form onSubmit={handleRequestSubmit} noValidate>
          <p className="mb-4 text-sm leading-relaxed text-ink/60">
            شماره تلفن ثبت‌شده خود را وارد کنید تا کد بازیابی برای آن پیامک شود.
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

          {requestMutation.isError && (
            <div className="mb-4 rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue" role="alert">
              {getErrorMessage(requestMutation.error)}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={requestMutation.isPending}>
            ارسال کد بازیابی
          </Button>

          <Link to={loginPath} className="mt-4 block text-center text-xs font-medium text-action hover:underline">
            بازگشت به صفحه ورود
          </Link>
        </form>
      )}
    </ParentAuthShell>
  );
}
