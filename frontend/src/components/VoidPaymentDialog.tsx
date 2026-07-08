import { useState } from 'react';
import type { ParsedApiError } from '../lib/error-handler';
import { FormError } from './FormError';

// Backend's VoidPaymentDto requires `reason` (5-300 chars) in the DELETE
// body — a plain window.confirm() (the old behavior) sent no body at all
// and always failed with 400. This collects that reason first.
export function VoidPaymentDialog({
  error,
  onConfirm,
  onCancel,
}: {
  error?: ParsedApiError | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const tooShort = reason.trim().length < 5;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
        <h3 className="mb-2 text-base font-bold text-ink">لغو پرداخت</h3>
        <p className="mb-4 text-sm text-ink/60">
          این عمل قابل بازگشت نیست. لطفاً دلیل لغو را بنویسید (حداقل ۵ کاراکتر).
        </p>
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
            onClick={() => onConfirm(reason.trim())}
            disabled={tooShort}
            className="flex-1 rounded-lg bg-overdue py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            لغو پرداخت
          </button>
          <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
