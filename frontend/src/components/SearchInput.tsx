import { forwardRef, InputHTMLAttributes, KeyboardEvent } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter, or when used inside a <form onSubmit=...> — matches
   *  the existing submit-triggered search pattern (e.g. StudentsPage). */
  onSubmit?: () => void;
  onClear?: () => void;
  containerClassName?: string;
}

// Self-contained search box: search icon (decorative) on the leading side,
// clickable clear (×) button on the trailing side once there's text. Built
// directly on the shared `.input` class rather than wrapping <Input>,
// because Input's icon slots are decorative-only (pointer-events-none) and
// can't host an interactive clear button.
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, onSubmit, onClear, placeholder = 'جستجو...', className = '', containerClassName = '', ...rest },
  ref,
) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className={`relative ${containerClassName}`}>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink/35 dark:text-paper/35">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`input pr-9 ${value ? 'pl-9' : ''} ${className}`}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          aria-label="پاک کردن جستجو"
          className="absolute inset-y-0 left-2 flex items-center px-1 text-ink/35 transition-colors hover:text-ink/70 dark:text-paper/35 dark:hover:text-paper/70"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
});
