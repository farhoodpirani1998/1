import { useEffect, useState } from 'react';

// Generic value debouncer: returns `value`, but only after it has stayed
// unchanged for `delayMs`. Used to delay how often a fast-changing input
// (e.g. a search box) triggers a query/filter recompute, without adding a
// submit button. Every pending timer is cleared on the next change/unmount,
// so only the most recent value is ever committed.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
