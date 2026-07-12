import type { PaymentMethod } from '../types/payment.types';

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => persianDigits[Number(d)]);
}

export function formatToman(amount: number): string {
  const grouped = Math.round(amount).toLocaleString('en-US');
  return toPersianDigits(grouped) + ' تومان';
}

export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return toPersianDigits(
      d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }),
    );
  } catch {
    return isoDate;
  }
}

// Was previously a module-private const duplicated in DashboardPage.tsx —
// moved here so every page (admin DashboardPage, parent portal pages)
// shares one source instead of each redefining the same three labels.
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  card_to_card: 'کارت‌به‌کارت',
  cheque: 'چک',
};
