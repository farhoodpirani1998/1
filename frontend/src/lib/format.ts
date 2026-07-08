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
