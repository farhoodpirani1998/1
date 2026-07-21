// Sprint P1 — Universal Avatar System.
//
// Single shared rendering for "a user's photo, or an initial-letter
// placeholder if they haven't uploaded one" — replaces the two
// hand-duplicated `<div>{fullName.charAt(0)}</div>` blocks that used to
// live separately in Topbar.tsx and Sidebar.tsx (see those files for
// before/after). avatarUrl is whatever User.avatarUrl currently is
// (relative URL under /uploads/avatars, or null) — same "reference, not
// bytes" value AuthUser/ManagedUser already carry, so callers can pass
// `user.avatarUrl` straight through with no extra plumbing.
//
// Sprint A2 — also used by SettingsPage's "آواتار من" panel for the
// current-avatar preview (size="xl"), alongside its original Topbar/
// Sidebar call sites.
//
// Deliberately NOT hardcoded to one size/shape/color: Topbar's existing
// badge was an 8x8 rounded-md square in the "action" accent color,
// Sidebar's was an 8x8 rounded-full circle in white-on-transparent —
// both need to keep looking exactly as they did before this component
// existed, so size/shape/color are all props with defaults matching the
// most common (Topbar's) look, not the only option.

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'rounded' | 'circle';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  // Sprint A2 — Avatar Management UI. Used only by the profile preview
  // in SettingsPage's "آواتار من" panel — large enough to actually see
  // detail in a just-uploaded photo, unlike the small nav badges above.
  xl: 'h-20 w-20 text-2xl',
};

const SHAPE_CLASSES: Record<AvatarShape, string> = {
  rounded: 'rounded-md',
  circle: 'rounded-full',
};

export interface AvatarProps {
  /** User.avatarUrl — a relative /uploads/avatars/... URL, or null/undefined for no photo. */
  avatarUrl?: string | null;
  /** Used for the initial-letter fallback and the image's alt text. */
  fullName?: string | null;
  /** Defaults to 'md' (8x8) — matches both of this component's original call sites. */
  size?: AvatarSize;
  /** Defaults to 'rounded' — matches Topbar's original badge; Sidebar passes 'circle'. */
  shape?: AvatarShape;
  /**
   * Tailwind background/text classes for the initial-letter fallback
   * only — has no effect once a real avatarUrl is set. Defaults to
   * Topbar's original action-accent colors; Sidebar passes its own
   * white-on-transparent classes to keep its original look.
   */
  colorClassName?: string;
  /** Extra classes merged onto the rendered element (e.g. `shrink-0`). */
  className?: string;
}

const DEFAULT_COLOR_CLASSNAME = 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light';

export function Avatar({
  avatarUrl,
  fullName,
  size = 'md',
  shape = 'rounded',
  colorClassName = DEFAULT_COLOR_CLASSNAME,
  className = '',
}: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const shapeClass = SHAPE_CLASSES[shape];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={fullName ?? 'آواتار کاربر'}
        className={`${sizeClass} ${shapeClass} shrink-0 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center font-semibold ${sizeClass} ${shapeClass} ${colorClassName} ${className}`}
    >
      {fullName?.charAt(0) ?? '?'}
    </div>
  );
}
