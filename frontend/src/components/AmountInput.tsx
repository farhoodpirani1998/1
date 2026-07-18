import { ChangeEvent, useId } from 'react';
import { toPersianDigits, toEnglishDigits } from '../lib/format';

interface AmountInputProps {
  label?: string;
  helperText?: string;
  containerClassName?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  value: number | '';
  onChange: (value: number | '') => void;
}

// A native <input type="number"> can't show thousand separators — the
// browser strips anything that isn't a digit, so a toman amount like
// ۵۰۰۰۰۰۰ just reads as an unbroken string of zeros. This renders as
// type="text" instead, grouping the value every 3 digits as the person
// types (۵٬۰۰۰٬۰۰۰), while still handing the caller a plain number (or ''
// when empty) — the same value shape a number input's onChange gives, so
// this drops in wherever a raw <input type="number"> was used for a
// toman amount (base tuition, discount, payment amount, ...).
export function AmountInput({
  label,
  helperText,
  containerClassName = '',
  className = '',
  required,
  disabled,
  min,
  max,
  placeholder,
  value,
  onChange,
}: AmountInputProps) {
  const generatedId = useId();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digitsOnly = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      onChange('');
      return;
    }
    // Strip leading zeros a person might type/paste (e.g. "007000") so
    // the grouped display doesn't show a leading ۰۰۷٬۰۰۰.
    const parsed = Number(digitsOnly);
    onChange(parsed);
  }

  const display = value === '' ? '' : toPersianDigits(value.toLocaleString('en-US').replace(/,/g, '٬'));

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={generatedId} className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">
          {label}
          {required && <span className="text-overdue"> *</span>}
        </label>
      )}
      <input
        id={generatedId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        disabled={disabled}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        // min/max aren't native constraints on a text input — callers
        // that need hard validation (e.g. discount ≤ base amount) still
        // check on submit, same as before. These are only surfaced via
        // aria for assistive tech.
        aria-valuemin={min}
        aria-valuemax={max}
        className={`input tabular ${className}`}
      />
      {helperText && <p className="mt-1.5 text-xs text-ink/45 dark:text-paper/45">{helperText}</p>}
    </div>
  );
}
