import { useParams, useNavigate } from 'react-router-dom';
import { formatToman, formatDate } from '../lib/format';
import { useReceipt } from '../hooks/usePayments';

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدی',
  card_to_card: 'کارت‌به‌کارت',
  cheque: 'چک',
};

// Sprint 1: receipt data now comes from GET /payments/:id/receipt (real
// backend query) instead of being reconstructed client-side from
// whatever the navigating caller had in memory. That's what makes
// schoolName/address/phone, receiptNumber, and receivedBy available here
// — none of those existed in the old router-state shape.
export function PrintReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const receiptQuery = useReceipt(paymentId);

  if (!paymentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <p className="mb-4 text-sm text-ink/60">شناسه پرداخت مشخص نیست.</p>
          <button onClick={() => navigate(-1)} className="rounded-lg bg-action px-4 py-2 text-sm text-white">
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  if (receiptQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-ink/50">در حال دریافت رسید...</p>
      </div>
    );
  }

  if (receiptQuery.isError || !receiptQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <p className="mb-4 text-sm text-ink/60">رسید یافت نشد یا دسترسی ندارید.</p>
          <button onClick={() => navigate(-1)} className="rounded-lg bg-action px-4 py-2 text-sm text-white">
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  const data = receiptQuery.data;

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper py-10 print:bg-white print:py-0">
      <div className="mb-4 flex gap-2 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg bg-action px-4 py-2 text-sm text-white hover:opacity-90">
          چاپ رسید
        </button>
        <button onClick={() => navigate(-1)} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-white">
          بازگشت
        </button>
      </div>

      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-card print:w-full print:max-w-none print:border-0 print:shadow-none">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold text-ink">{data.school.name}</div>
          {data.school.address && <div className="mt-0.5 text-[11px] text-ink/40">{data.school.address}</div>}
          {data.school.phone && <div className="text-[11px] text-ink/40">{data.school.phone}</div>}
          <div className="mt-2 text-xs text-ink/50">رسید پرداخت شهریه</div>
        </div>

        <table className="w-full text-sm">
          <tbody>
            {data.receiptNumber && <Row label="شماره رسید" value={data.receiptNumber} />}
            <Row label="دانش‌آموز" value={data.student.fullName} />
            <Row label="مبلغ پرداختی" value={formatToman(data.amount)} />
            <Row
              label="روش پرداخت"
              value={
                data.paymentMethod
                  ? (paymentMethodLabels[data.paymentMethod] ?? data.paymentMethod)
                  : '—'
              }
            />
            <Row label="تاریخ" value={formatDate(data.paidAt)} />
            {data.receivedBy && <Row label="دریافت‌کننده" value={data.receivedBy.fullName} />}
          </tbody>
        </table>

        <div className="mt-8 border-t border-line pt-4 text-center text-xs text-ink/40">
          این رسید به‌صورت الکترونیکی صادر شده است.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="py-2 text-ink/60">{label}</td>
      <td className="tabular py-2 text-left font-medium text-ink">{value}</td>
    </tr>
  );
}
