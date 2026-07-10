import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  children: ReactNode;
}

// Generic label+control wrapper for custom form controls that aren't a
// plain <input>/<select> (e.g. a composed widget). Input and Select above
// already build this layout in for the common case; this is exposed
// separately for anything else that needs the same label/error/helper
// treatment without duplicating markup per page.
export function Field({ label, htmlFor, required, error, helperText, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">
        {label}
        {required && <span className="text-overdue"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-overdue">{error}</p>
      ) : (
        helperText && <p className="mt-1.5 text-xs text-ink/45 dark:text-paper/45">{helperText}</p>
      )}
    </div>
  );
}
