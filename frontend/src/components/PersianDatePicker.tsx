import { useEffect, useId, useRef, useState } from 'react';
import {
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_SHORT,
  isoToJalali,
  jalaliToIso,
  jalaliMonthLength,
  jalaliWeekday,
  todayJalali,
  type JalaliDate,
} from '../lib/jalali';
import { toPersianDigits } from '../lib/format';
import { CalendarIcon } from './icons/SchoolIcons';

interface PersianDatePickerProps {
  /** ISO 'YYYY-MM-DD', or '' for no selection — same value shape as the
   *  native `<input type="date">` this replaces, so nothing downstream
   *  (API payloads, formatDate()) needs to change. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Visual asterisk only — see the note above the component below on
   *  why this can't block native form submission the way the plain
   *  `<input type="date" required>` it replaces used to. */
  required?: boolean;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  containerClassName?: string;
  className?: string;
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function formatJalaliDisplay(j: JalaliDate): string {
  return toPersianDigits(`${j.jd} ${JALALI_MONTH_NAMES[j.jm - 1]} ${j.jy}`);
}

// A Jalali (Persian/Shamsi) calendar date picker — drop-in replacement
// for `<input type="date">` (native HTML date inputs render a
// Gregorian-only calendar popup in effectively every browser, regardless
// of page locale, even though the *stored/displayed* date elsewhere in
// this app is correctly shown in Jalali via formatDate()). This fixes
// that mismatch: same underlying ISO value, but the picker UI itself is
// now Jalali too.
//
// NOTE on `required`: a native `<input required>` blocks form submission
// in-browser with a validation bubble. This component renders a button,
// not a native form control, so it can't do that — `required` here only
// draws the asterisk. Every call site already handles a missing/invalid
// date via its mutation's backend validation error, so this is a minor
// UX regression (no more instant in-browser nudge), not a functional one.
export function PersianDatePicker({
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  placeholder = 'انتخاب تاریخ',
  disabled,
  containerClassName = '',
  className = '',
}: PersianDatePickerProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = isoToJalali(value);
  const [view, setView] = useState<{ jy: number; jm: number }>(() => {
    const base = selected ?? todayJalali();
    return { jy: base.jy, jm: base.jm };
  });

  // Keep the calendar's visible month in sync if `value` changes from
  // outside (e.g. a parent resetting the form after save).
  useEffect(() => {
    if (open) return;
    const base = selected ?? todayJalali();
    setView({ jy: base.jy, jm: base.jm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function goToMonth(deltaMonths: number) {
    setView((prev) => {
      let jm = prev.jm + deltaMonths;
      let jy = prev.jy;
      while (jm > 12) {
        jm -= 12;
        jy += 1;
      }
      while (jm < 1) {
        jm += 12;
        jy -= 1;
      }
      return { jy, jm };
    });
  }

  function pickDay(jd: number) {
    onChange(jalaliToIso(view.jy, view.jm, jd));
    setOpen(false);
  }

  function pickToday() {
    const t = todayJalali();
    setView({ jy: t.jy, jm: t.jm });
    onChange(jalaliToIso(t.jy, t.jm, t.jd));
    setOpen(false);
  }

  function clearValue() {
    onChange('');
    setOpen(false);
  }

  const monthLength = jalaliMonthLength(view.jy, view.jm);
  const leadingBlanks = jalaliWeekday(view.jy, view.jm, 1);
  const today = todayJalali();

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: monthLength }, (_, i) => i + 1),
  ];

  return (
    <div className={containerClassName} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink dark:text-paper">
          {label}
          {required && <span className="text-overdue"> *</span>}
        </label>
      )}

      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`input flex w-full items-center justify-between gap-2 text-right disabled:cursor-not-allowed disabled:opacity-60 ${
            error ? 'border-overdue focus:border-overdue focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]' : ''
          } ${className}`}
        >
          <span className={`tabular truncate ${selected ? 'text-ink dark:text-paper' : 'text-ink/35 dark:text-paper/35'}`}>
            {selected ? formatJalaliDisplay(selected) : placeholder}
          </span>
          <span className="shrink-0 text-ink/35 dark:text-paper/35">
            <CalendarIcon size={16} />
          </span>
        </button>

        {open && (
          <div
            role="dialog"
            className="absolute z-20 mt-1.5 w-72 rounded-xl border border-line bg-white p-3 shadow-pop dark:border-white/10 dark:bg-navy-dark"
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                className="rounded-md p-1 text-ink/60 transition-colors hover:bg-paper dark:text-paper/60 dark:hover:bg-white/10"
                aria-label="ماه قبل"
              >
                <ChevronRight />
              </button>
              <div className="flex items-center gap-1.5 text-sm font-medium text-ink dark:text-paper">
                <select
                  value={view.jm}
                  onChange={(e) => setView((p) => ({ ...p, jm: Number(e.target.value) }))}
                  className="rounded-md border-0 bg-transparent py-0.5 text-sm font-medium text-ink focus:outline-none focus:ring-1 focus:ring-action dark:text-paper"
                >
                  {JALALI_MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={view.jy}
                  onChange={(e) => setView((p) => ({ ...p, jy: Number(e.target.value) }))}
                  className="tabular rounded-md border-0 bg-transparent py-0.5 text-sm font-medium text-ink focus:outline-none focus:ring-1 focus:ring-action dark:text-paper"
                >
                  {Array.from({ length: 21 }, (_, i) => today.jy - 10 + i).map((y) => (
                    <option key={y} value={y}>
                      {toPersianDigits(y)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                className="rounded-md p-1 text-ink/60 transition-colors hover:bg-paper dark:text-paper/60 dark:hover:bg-white/10"
                aria-label="ماه بعد"
              >
                <ChevronLeft />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink/40 dark:text-paper/40">
              {JALALI_WEEKDAY_SHORT.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((jd, i) => {
                if (jd === null) return <div key={`blank-${i}`} />;
                const isSelected = !!selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === jd;
                const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === jd;
                return (
                  <button
                    key={jd}
                    type="button"
                    onClick={() => pickDay(jd)}
                    className={`tabular flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-action font-semibold text-white'
                        : isToday
                          ? 'border border-action/50 text-action dark:text-action-light'
                          : 'text-ink/80 hover:bg-paper dark:text-paper/80 dark:hover:bg-white/10'
                    }`}
                  >
                    {toPersianDigits(jd)}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 dark:border-white/10">
              <button
                type="button"
                onClick={pickToday}
                className="text-xs font-medium text-action hover:underline"
              >
                امروز
              </button>
              {value && (
                <button
                  type="button"
                  onClick={clearValue}
                  className="text-xs font-medium text-ink/50 hover:text-overdue dark:text-paper/50"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-overdue">{error}</p>
      ) : (
        helperText && <p className="mt-1.5 text-xs text-ink/45 dark:text-paper/45">{helperText}</p>
      )}
    </div>
  );
}
