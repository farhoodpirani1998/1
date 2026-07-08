import { useLocation, useNavigate } from 'react-router-dom';
import { formatToman, formatDate } from '../lib/format';

export interface ReceiptData {
  studentName: string;
  installmentNumber: number;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  paidAt: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدی',
  card_to_card: 'کارت‌به‌کارت',
  cheque: 'چک',
};

export function PrintReceiptPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state as ReceiptData | null;

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <p className="mb-4 text-sm text-ink/60">اطلاعات رسید یافت نشد.</p>
          <button onClick={() => navigate(-1)} className="rounded-lg bg-action px-4 py-2 text-sm text-white">
            بازگشت
          </button>
        </div>
      </div>
    );
  }

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
          <div className="text-lg font-bold text-ink">دفتر مدرسه</div>
          <div className="text-xs text-ink/50">رسید پرداخت شهریه</div>
        </div>

        <table className="w-full text-sm">
          <tbody>
            <Row label="دانش‌آموز" value={data.studentName} />
            <Row label="شماره قسط" value={String(data.installmentNumber)} />
            <Row label="مبلغ پرداختی" value={formatToman(data.amount)} />
            <Row label="روش پرداخت" value={paymentMethodLabels[data.paymentMethod] ?? data.paymentMethod} />
            {data.referenceNumber && <Row label="شماره پیگیری" value={data.referenceNumber} />}
            <Row label="تاریخ" value={formatDate(data.paidAt)} />
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
