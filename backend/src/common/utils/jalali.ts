/**
 * Minimal Gregorian → Jalali (Persian) calendar conversion.
 *
 * Only the Jalali *year* is needed (for receipt numbers like
 * "1405-000001"), so this exposes just that instead of a full calendar
 * library — one pure function, no new dependency. Algorithm is the
 * standard public-domain Gregorian→Jalali conversion (d2j), same one used
 * by e.g. jalaali-js, reproduced here in miniature.
 */
export function gregorianToJalaliYear(date: Date): number {
  const gy = date.getUTCFullYear();
  const gm = date.getUTCMonth() + 1;
  const gd = date.getUTCDate();

  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const adjustedGy = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy2 = gm > 2 ? adjustedGy + 1 : adjustedGy;
  let days =
    365 * adjustedGy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
  }
  return jy;
}
