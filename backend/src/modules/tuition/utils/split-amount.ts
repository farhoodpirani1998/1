/**
 * Splits `totalAmount` into `count` equal integer shares, putting the
 * rounding remainder on the last share so the sum always matches
 * `totalAmount` exactly. Shared by InstallmentsService.generate() (first
 * generation), TuitionPlansService (redistributing a post-generation
 * discount change across still-pending installments), and
 * InstallmentsService.renegotiate() (rescheduling the unpaid remainder) —
 * one implementation so the rounding rule can't drift between the three.
 */
export function splitAmount(totalAmount: number, count: number): number[] {
  if (count <= 0) return [];
  const baseShare = Math.floor(totalAmount / count);
  const remainder = totalAmount - baseShare * count;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? baseShare + remainder : baseShare,
  );
}
