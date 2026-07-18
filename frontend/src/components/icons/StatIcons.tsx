// Shared icon set for StatCard/KPICard usage across the admin + founder
// dashboards. These were previously copy-pasted verbatim (TuitionIcon,
// CheckIcon, AlertIcon) or near-duplicated with slightly different
// strokeWidth/size (1.8 vs 2, 18px vs 20px) between DashboardPage.tsx and
// FounderSchoolDashboardPage.tsx. Consolidated here with one fixed
// STROKE_WIDTH so every stat icon reads at the same visual weight —
// still generic feather-style outline icons, not a custom school/financial
// icon set (that needs an actual design direction, not something to invent
// unilaterally here).
const STROKE_WIDTH = 1.75;

interface IconProps {
  size?: number;
}

export function TuitionIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M8 15h3" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function AlertIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function ListIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function UsersIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 14c2.5.3 4.5 2.3 4.5 4.8" />
    </svg>
  );
}

export function StudentsIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

export function AttendanceIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4m-8 7 2 2 4-4" />
    </svg>
  );
}

export function ScoreIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

export function TargetIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
