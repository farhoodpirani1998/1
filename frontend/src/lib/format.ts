import type { PaymentMethod } from '../types/payment.types';

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => persianDigits[Number(d)]);
}

export function formatToman(amount: number): string {
  const grouped = Math.round(amount).toLocaleString('en-US');
  return toPersianDigits(grouped) + ' تومان';
}

// Splits a formatToman()-style string ("۱۲۰٬۰۰۰ تومان") into the number and
// the unit, so callers can render "تومان" smaller/lighter than the number
// itself instead of matching its weight — most useful in big single-number
// displays (StatCard's 'lg' size, ReportsPage's StatBox) where the number is
// what should read first. Anything without the trailing unit (a plain count,
// a percentage, '—') is returned unchanged with unit: null.
const CURRENCY_UNIT = ' تومان';
export function splitCurrencyValue(value: string): { amount: string; unit: string | null } {
  if (value.endsWith(CURRENCY_UNIT)) {
    return { amount: value.slice(0, -CURRENCY_UNIT.length), unit: 'تومان' };
  }
  return { amount: value, unit: null };
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
