import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

// Wraps the existing .input class (defined in index.css) with an optional
// label / error / helper-text / icon layout. Purely additive — any page
// still passing className="input" directly to a raw <input> keeps working
// exactly as before; this component is an opt-in convenience for new or
// updated forms.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, leftIcon, rightIcon, containerClassName = '', className = '', id, required, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">
          {label}
          {required && <span className="text-overdue"> *</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink/35 dark:text-paper/35">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error}
          className={`input ${leftIcon ? 'pr-9' : ''} ${rightIcon ? 'pl-9' : ''} ${
            error ? 'border-overdue focus:border-overdue focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]' : ''
          } ${className}`}
          {...rest}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/35 dark:text-paper/35">
            {rightIcon}
          </span>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-overdue">{error}</p>
      ) : (
        helperText && <p className="mt-1.5 text-xs text-ink/45 dark:text-paper/45">{helperText}</p>
      )}
    </div>
  );
});
