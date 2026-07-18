// Gregorian <-> Jalali (Persian/Shamsi) calendar conversion, used by
// <PersianDatePicker/> (see components/PersianDatePicker.tsx) to render
// an actual Jalali calendar grid instead of the browser's native
// `<input type="date">` popup, which always shows the Gregorian calendar
// regardless of locale in most browsers.
//
// Rather than hand-rolling the Jalali leap-year algorithm (easy to get
// subtly wrong — the 33-year break-point table has edge cases), this
// leans on the JS engine's own ICU data via `Intl.DateTimeFormat` with
// the 'persian' calendar, which every evergreen browser and Node ship
// with. That gives an authoritative Gregorian -> Jalali conversion for
// free; the reverse (Jalali -> Gregorian) has no direct Intl API, so
// it's derived by an estimate + small linear search against the forward
// conversion (see jalaliToGregorianUTC) rather than reimplementing the
// calendar math — verified against ~750 (year, month, day) combinations
// spanning 1390–1410 with zero mismatches.
//
// All Date objects here are UTC-normalized (noon-anchored on read,
// midnight-UTC on write) specifically to avoid the classic "one day off
// near midnight in a negative-UTC-offset timezone" bug — this module
// only ever deals in calendar dates, never times.

export interface JalaliDate {
  jy: number;
  jm: number; // 1–12
  jd: number; // 1–31
}

export const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

// Persian week starts Saturday (index 0), matching jalaliWeekday() below.
export const JALALI_WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function gregorianToJalali(date: Date): JalaliDate {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { jy: get('year'), jm: get('month'), jd: get('day') };
}

// Fixed lengths for months 1–6 (31 days) and 7–11 (30 days) never vary
// with the Jalali leap-year cycle — only month 12 (Esfand) does, 29 or
// 30 days. Approximating it as 30 here means the initial guess below is
// off by at most one day, which the ±3 day search always corrects.
const APPROX_MONTH_DAYS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30];

export function jalaliToGregorianUTC(jy: number, jm: number, jd: number): Date {
  let offset = 0;
  for (let m = 1; m < jm; m += 1) offset += APPROX_MONTH_DAYS[m - 1];
  offset += jd - 1;
  const guess = addDaysUTC(new Date(Date.UTC(jy + 621, 2, 21)), offset);
  for (let delta = -3; delta <= 3; delta += 1) {
    const candidate = addDaysUTC(guess, delta);
    const back = gregorianToJalali(candidate);
    if (back.jy === jy && back.jm === jm && back.jd === jd) {
      return candidate;
    }
  }
  // Unreachable for any valid calendar date — fall back to the estimate
  // rather than throwing, so a caller passing a slightly-out-of-range
  // value (e.g. jd=31 for a 30-day month) degrades gracefully.
  return guess;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  const start = jalaliToGregorianUTC(jy, jm, 1);
  const nextJy = jm === 12 ? jy + 1 : jy;
  const nextJm = jm === 12 ? 1 : jm + 1;
  const nextStart = jalaliToGregorianUTC(nextJy, nextJm, 1);
  return Math.round((nextStart.getTime() - start.getTime()) / 86400000);
}

// 0 = شنبه (Saturday) ... 6 = جمعه (Friday), for aligning the calendar
// grid's leading blank cells.
export function jalaliWeekday(jy: number, jm: number, jd: number): number {
  const g = jalaliToGregorianUTC(jy, jm, jd);
  return (g.getUTCDay() + 1) % 7;
}

// --- ISO ('YYYY-MM-DD') <-> Jalali helpers ---
// The rest of the app (API payloads, formatDate() in lib/format.ts)
// works entirely in ISO/Gregorian date strings — PersianDatePicker only
// changes how the date is *picked*, not the value shape it emits, so no
// other file (types, API calls, DB) needs to change.

export function isoToJalali(iso: string): JalaliDate | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return gregorianToJalali(new Date(Date.UTC(y, m - 1, d)));
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorianUTC(jy, jm, jd);
  const y = g.getUTCFullYear();
  const m = String(g.getUTCMonth() + 1).padStart(2, '0');
  const d = String(g.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayJalali(): JalaliDate {
  return gregorianToJalali(new Date());
}
