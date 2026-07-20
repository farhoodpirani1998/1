import type { PaymentMethod } from '../types/payment.types';
import type { AssessmentTerm } from '../types/parent.types';

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => persianDigits[Number(d)]);
}

// Inverse of toPersianDigits — needed because a Persian keyboard types
// ۰-۹ directly, so any input we parse back into a number (AmountInput)
// has to accept both digit sets.
export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
}

export function formatToman(amount: number): string {
  const grouped = Math.round(amount).toLocaleString('en-US').replace(/,/g, '٬');
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

// Compact "زمان نسبی" — for feeds where the exact date is less useful than
// how recent something is (notifications widget, activity timeline). Falls
// back to formatDate() once something is more than a week old, since
// "۱۲ روز پیش" reads worse than an actual date at that distance.
export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return isoDate;
  const diffMs = Date.now() - then;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) return 'همین الان';
  if (diffMinutes < 60) return `${toPersianDigits(diffMinutes)} دقیقه پیش`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${toPersianDigits(diffHours)} ساعت پیش`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'دیروز';
  if (diffDays < 7) return `${toPersianDigits(diffDays)} روز پیش`;
  return formatDate(isoDate);
}

// Was previously a module-private const duplicated in DashboardPage.tsx —
// moved here so every page (admin DashboardPage, parent portal pages)
// shares one source instead of each redefining the same three labels.
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  card_to_card: 'کارت‌به‌کارت',
  cheque: 'چک',
};

// Was previously duplicated identically across ParentReportCardPage,
// StudentDashboardPage, StudentAssessmentsPage and StudentReportCardPage —
// moved here so every page shares one source instead of each redefining
// the same score-rounding rule and term labels (same "was duplicated,
// now shared" move as paymentMethodLabels above). Scores can be
// fractional (e.g. 17.5); this avoids a trailing ".00" for whole numbers
// while still showing decimals when they matter.
export function formatScore(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return toPersianDigits(Number.isInteger(rounded) ? rounded : rounded.toFixed(2));
}

export const assessmentTermLabels: Record<AssessmentTerm, string> = {
  first_term: 'ترم اول',
  second_term: 'ترم دوم',
};
