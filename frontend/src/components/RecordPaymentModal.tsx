import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatToman } from '../lib/format';
import { useToast } from '../lib/toast';
import { useCreatePayment } from '../hooks/usePayments';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from './FormError';
import { AmountInput } from './AmountInput';

export interface PayableInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
}

// Brief success tick shown after a payment is recorded, before handing off
// to the receipt page — confirms the action landed instead of jumping
// straight to a new page with no visible acknowledgement.
function SuccessTick() {
  return (
    <div className="success-pop flex h-14 w-14 items-center justify-center rounded-full bg-paid-soft text-paid dark:bg-paid/15">
      <svg className="success-check" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
      </svg>
    </div>
  );
}

// How long the success tick stays on screen before navigating to the
// receipt page — long enough to register, short enough not to feel like a
// delay in a one-step flow.
const SUCCESS_TICK_MS = 550;

export function RecordPaymentModal({
  installment,
  studentId,
  studentName: _studentName,
  onClose,
  onSaved,
}: {
  installment: PayableInstallment;
  // Optional: passed by StudentDetailPage (knows the student in context)
  // so the mutation can target that student's statement cache directly.
  // InstallmentsPage doesn't have it handy and relies on the mutation's
  // broader reports.all()/installments.all() invalidation instead — see
  // usePayments.ts.
  studentId?: string;
  // Used to build the receipt (see ReceiptData in PrintReceiptPage) once
  // the payment succeeds — both call sites (StudentDetailPage,
  // InstallmentsPage) already have the student's name in context.
  studentName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const createPayment = useCreatePayment();
  const remaining = installment.amount - installment.paidAmount;
  const [amount, setAmount] = useState<number | ''>(remaining);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card_to_card' | 'cheque'>('card_to_card');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);
  // Set once the payment mutation succeeds — while this holds a value, the
  // form is replaced with the success tick (showing the amount just paid)
  // and navigation to the receipt page is queued for SUCCESS_TICK_MS later.
  const [succeededAmount, setSucceededAmount] = useState<number | null>(null);
  // Generated once when the modal opens; sent on every retry of the same
  // submit action so a double-click or network retry can't create two
  // payments — backend's CreatePaymentDto.idempotencyKey exists for this.
  // Mutation retry is off globally (see App.tsx) so this only guards
  // against the user clicking twice, but the key is still worth keeping
  // stable across that.
  const idempotencyKey = useRef(crypto.randomUUID()).current;

  function handleSubmit() {
    setError(null);
    if (amount === '') return;
    createPayment.mutate(
      {
        installmentId: installment.id,
        studentId,
        dto: {
          amount,
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
          paidAt: new Date().toISOString(),
          idempotencyKey,
        },
      },
      {
        onSuccess: (payment) => {
          showSuccess('پرداخت با موفقیت ثبت شد');
          onSaved();
          // One-step flow: go straight to the receipt page instead of
          // leaving the user to find a "چاپ رسید" link for the payment
          // they just made. The page now fetches the receipt itself from
          // GET /payments/:id/receipt, so all we pass along is the id.
          setSucceededAmount(payment.amount);
          setTimeout(() => navigate(`/print/receipt/${payment.id}`), SUCCESS_TICK_MS);
        },
        onError: (err) => {
          setError(parseApiError(err));
          showError(getErrorMessage(err));
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
        {succeededAmount !== null ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <SuccessTick />
            <p className="text-sm font-medium text-ink">پرداخت ثبت شد</p>
            <p className="tabular text-xs text-ink/50">{formatToman(succeededAmount)}</p>
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-base font-bold text-ink">
              ثبت پرداخت — قسط {installment.installmentNumber}
            </h3>
            <p className="mb-4 text-sm text-ink/60">باقیمانده: {formatToman(remaining)}</p>

            <AmountInput
              label="مبلغ پرداختی (تومان)"
              value={amount}
              onChange={setAmount}
              max={remaining}
              min={1}
              containerClassName="mb-4"
            />

            <label className="mb-1.5 block text-sm font-medium text-ink">روش پرداخت</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="input mb-4"
            >
              <option value="card_to_card">کارت‌به‌کارت</option>
              <option value="cash">نقدی</option>
              <option value="cheque">چک</option>
            </select>

            <label className="mb-1.5 block text-sm font-medium text-ink">شماره پیگیری (اختیاری)</label>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="input mb-4"
            />

            <FormError error={error} />

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={createPayment.isPending}
                className="flex-1 rounded-lg bg-action py-2 text-sm font-medium text-white transition-transform active:scale-[0.97] hover:opacity-90 disabled:opacity-50 disabled:active:scale-100"
              >
                {createPayment.isPending ? 'در حال ثبت...' : 'ثبت پرداخت'}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-line px-4 py-2 text-sm transition-transform active:scale-[0.97] hover:bg-paper"
              >
                انصراف
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
