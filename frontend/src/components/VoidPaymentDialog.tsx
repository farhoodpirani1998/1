import { useState } from 'react';
import { formatToman, formatDate } from '../lib/format';
import type { ParsedApiError } from '../lib/error-handler';
import { FormError } from './FormError';

// Backend's VoidPaymentDto requires `reason` (5-300 chars) in the DELETE
// body — a plain window.confirm() (the old behavior) sent no body at all
// and always failed with 400. This collects that reason first.
//
// Two-step flow: step 1 collects the reason and shows the payment being
// voided (amount, date, student) so it's never lifted from a table row on
// autopilot; step 2 asks for an explicit final confirmation, showing the
// same summary once more, before the irreversible request goes out. Voiding
// a payment can't be undone and directly affects a family's balance, so the
// extra step is meant to catch a wrong-row click before it happens rather
// than after.
export function VoidPaymentDialog({
  amount,
  paidAt,
  studentName,
  error,
  onConfirm,
  onCancel,
}: {
  amount: number;
  paidAt: string;
  studentName: string;
  error?: ParsedApiError | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const tooShort = reason.trim().length < 5;

  const summary = (
    <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-paper px-3 py-2.5 text-sm dark:bg-white/5">
      <dt className="text-ink/50 dark:text-paper/50">دانش‌آموز</dt>
      <dd className="text-left font-medium text-ink dark:text-paper">{studentName || '—'}</dd>
      <dt className="text-ink/50 dark:text-paper/50">مبلغ پرداخت</dt>
      <dd className="tabular text-left font-medium text-overdue">{formatToman(amount)}</dd>
      <dt className="text-ink/50 dark:text-paper/50">تاریخ پرداخت</dt>
      <dd className="tabular text-left text-ink/70 dark:text-paper/70">{formatDate(paidAt)}</dd>
    </dl>
  );

  if (confirming) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
          <h3 className="mb-2 text-base font-bold text-overdue">تأیید نهایی لغو پرداخت</h3>
          <p className="mb-4 text-sm text-ink/60">
            این عملیات غیرقابل بازگشت است و بلافاصله روی مانده حساب دانش‌آموز اثر می‌گذارد.
          </p>
          {summary}
          <p className="mb-4 rounded-lg bg-overdue/5 px-3 py-2 text-xs text-ink/60">دلیل ثبت‌شده: {reason.trim()}</p>
          <FormError error={error ?? null} />
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(reason.trim())}
              className="flex-1 rounded-lg bg-overdue py-2 text-sm font-medium text-white transition-transform active:scale-[0.97] hover:opacity-90"
            >
              بله، پرداخت لغو شود
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm transition-transform active:scale-[0.97] hover:bg-paper"
            >
              بازگشت
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
        <h3 className="mb-2 text-base font-bold text-ink">لغو پرداخت</h3>
        <p className="mb-4 text-sm text-ink/60">
          این عمل قابل بازگشت نیست. لطفاً دلیل لغو را بنویسید (حداقل ۵ کاراکتر).
        </p>
        {summary}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="input mb-4"
          placeholder="مثلاً: پرداخت اشتباهی دوباره ثبت شده بود"
        />
        <FormError error={error ?? null} />
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(true)}
            disabled={tooShort}
            className="flex-1 rounded-lg bg-overdue py-2 text-sm font-medium text-white transition-transform active:scale-[0.97] hover:opacity-90 disabled:opacity-40 disabled:active:scale-100"
          >
            ادامه
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm transition-transform active:scale-[0.97] hover:bg-paper"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
