export type TableDensity = 'compact' | 'comfortable';

interface DensityToggleProps {
  value: TableDensity;
  onChange: (value: TableDensity) => void;
}

// Sprint A2.1's "view controls" — a segmented compact/comfortable toggle
// wired to <Table density=.../> (Table already supported this prop before
// any page exposed a control for it). Extracted here in Sprint A3.1 so the
// Teacher Workspace's toolbar can reuse the identical control instead of
// re-implementing the same two buttons; purely presentational, no query or
// filtering behavior involved.
export function DensityToggle({ value, onChange }: DensityToggleProps) {
  return (
    <div
      role="group"
      aria-label="نمای جدول"
      className="inline-flex items-center rounded-lg border border-line p-0.5 dark:border-white/10"
    >
      <button
        type="button"
        onClick={() => onChange('comfortable')}
        aria-pressed={value === 'comfortable'}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          value === 'comfortable'
            ? 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light'
            : 'text-ink/50 hover:text-ink dark:text-paper/50 dark:hover:text-paper'
        }`}
      >
        راحت
      </button>
      <button
        type="button"
        onClick={() => onChange('compact')}
        aria-pressed={value === 'compact'}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          value === 'compact'
            ? 'bg-action-soft text-action dark:bg-action/15 dark:text-action-light'
            : 'text-ink/50 hover:text-ink dark:text-paper/50 dark:hover:text-paper'
        }`}
      >
        فشرده
      </button>
    </div>
  );
}
