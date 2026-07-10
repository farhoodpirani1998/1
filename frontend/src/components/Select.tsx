import { forwardRef, SelectHTMLAttributes, ReactNode, useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
  children?: ReactNode;
}

// Wraps the existing .input class with a custom chevron (native selects
// render inconsistent arrows across browsers) plus optional label / error /
// helper-text. Accepts either an `options` array or raw <option> children,
// so it can be dropped in wherever a plain <select className="input">
// is used today without changing the surrounding data flow.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    helperText,
    options,
    placeholder,
    containerClassName = '',
    className = '',
    id,
    required,
    children,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">
          {label}
          {required && <span className="text-overdue"> *</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={!!error}
          className={`input appearance-none pl-9 ${
            error ? 'border-overdue focus:border-overdue focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]' : ''
          } ${className}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled={rest.value !== ''}>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/40 dark:text-paper/40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-overdue">{error}</p>
      ) : (
        helperText && <p className="mt-1.5 text-xs text-ink/45 dark:text-paper/45">{helperText}</p>
      )}
    </div>
  );
});
