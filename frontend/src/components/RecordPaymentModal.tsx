import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatToman } from '../lib/format';
import { useToast } from '../lib/toast';
import { useCreatePayment } from '../hooks/usePayments';
import { parseApiError, getErrorMessage, ParsedApiError } from '../lib/error-handler';
import { FormError } from './FormError';
import type { ReceiptData } from '../pages/PrintReceiptPage';

export interface PayableInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
}

export function RecordPaymentModal({
  installment,
  studentId,
  studentName,
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
  const [amount, setAmount] = useState(remaining);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card_to_card' | 'cheque'>('card_to_card');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState<ParsedApiError | null>(null);
  // Generated once when the modal opens; sent on every retry of the same
  // submit action so a double-click or network retry can't create two
  // payments — backend's CreatePaymentDto.idempotencyKey exists for this.
  // Mutation retry is off globally (see App.tsx) so this only guards
  // against the user clicking twice, but the key is still worth keeping
  // stable across that.
  const idempotencyKey = useRef(crypto.randomUUID()).current;

  function handleSubmit() {
    setError(null);
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
          // One-step flow: go straight to the existing receipt page instead
          // of leaving the user to find a "چاپ رسید" link for the payment
          // they just made. Reuses the same ReceiptData shape the manual
          // print links already build (see StudentDetailPage) — no new
          // fields, no backend change.
          const receipt: ReceiptData = {
            studentName,
            installmentNumber: installment.installmentNumber,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod ?? paymentMethod,
            referenceNumber: payment.referenceNumber ?? undefined,
            paidAt: payment.paidAt,
          };
          navigate('/print/receipt', { state: receipt });
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
        <h3 className="mb-4 text-base font-bold text-ink">
          ثبت پرداخت — قسط {installment.installmentNumber}
        </h3>
        <p className="mb-4 text-sm text-ink/60">باقیمانده: {formatToman(remaining)}</p>

        <label className="mb-1.5 block text-sm font-medium text-ink">مبلغ پرداختی (تومان)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          max={remaining}
          min={1}
          className="input mb-4 tabular"
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
            className="flex-1 rounded-lg bg-action py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {createPayment.isPending ? 'در حال ثبت...' : 'ثبت پرداخت'}
          </button>
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
