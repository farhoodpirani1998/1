import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from './SearchInput';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { toPersianDigits, formatDate } from '../lib/format';
import type { SearchResults } from '../types/search.types';

const SEARCH_DEBOUNCE_MS = 300;

// Phase 5N: Global Search, wired into the Topbar. Every group now has a
// real staff-facing detail route to link to: students -> /students/:id,
// parents -> /guardians/:id, teachers -> /teachers/:id, subjects ->
// /subjects/:id, homework -> /homework/:id, announcements ->
// /announcements/:id. All six results rows are buttons that close the
// panel, clear the query, and navigate — same goToResult() shape for
// every group.
const categoryLabels: Record<keyof SearchResults, string> = {
  students: 'دانش‌آموزان',
  parents: 'والدین',
  teachers: 'معلمان',
  subjects: 'دروس',
  homework: 'تکالیف',
  announcements: 'اطلاعیه‌ها',
};

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQ = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const searchQuery = useGlobalSearch(debouncedQ);
  const results = searchQuery.data;
  const hasAnyResults =
    !!results && Object.values(results).some((group) => group.length > 0);

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

  function goToResult(path: string) {
    setOpen(false);
    setQ('');
    navigate(path);
  }

  return (
    <div ref={containerRef} className="relative hidden w-64 sm:block lg:w-80">
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="جستجوی سراسری..."
      />

      {open && debouncedQ.trim() && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-line bg-white shadow-card dark:border-white/10 dark:bg-navy-dark">
          {searchQuery.isLoading && (
            <div className="p-4 text-center text-sm text-ink/45 dark:text-paper/45">در حال جستجو...</div>
          )}

          {searchQuery.isError && (
            <div className="p-4 text-center text-sm text-overdue">خطا در جستجو</div>
          )}

          {results && !hasAnyResults && (
            <div className="p-4 text-center text-sm text-ink/45 dark:text-paper/45">نتیجه‌ای یافت نشد</div>
          )}

          {results && hasAnyResults && (
            <div className="py-1.5">
              {results.students.length > 0 && (
                <div className="px-1.5">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-ink/40 dark:text-paper/40">
                    {categoryLabels.students}
                  </div>
                  {results.students.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => goToResult(`/students/${s.id}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-sm text-ink transition-colors hover:bg-paper dark:text-paper dark:hover:bg-white/5"
                    >
                      <span>{s.fullName}</span>
                      {s.nationalId && (
                        <span className="text-xs text-ink/40 dark:text-paper/40">
                          {toPersianDigits(s.nationalId)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {results.parents.length > 0 && (
                <div className="px-1.5 pt-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-ink/40 dark:text-paper/40">
                    {categoryLabels.parents}
                  </div>
                  {results.parents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => goToResult(`/guardians/${p.id}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-sm text-ink transition-colors hover:bg-paper dark:text-paper dark:hover:bg-white/5"
                    >
                      <span>{p.fullName}</span>
                      <span className="text-xs text-ink/40 dark:text-paper/40">{toPersianDigits(p.phone)}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.teachers.length > 0 && (
                <div className="px-1.5 pt-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-ink/40 dark:text-paper/40">
                    {categoryLabels.teachers}
                  </div>
                  {results.teachers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => goToResult(`/teachers/${t.id}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-sm text-ink transition-colors hover:bg-paper dark:text-paper dark:hover:bg-white/5"
                    >
                      <span>{t.fullName}</span>
                      <span className="text-xs text-ink/40 dark:text-paper/40">{toPersianDigits(t.phone)}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.subjects.length > 0 && (
                <div className="px-1.5 pt-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-ink/40 dark:text-paper/40">
                    {categoryLabels.subjects}
                  </div>
                  {results.subjects.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => goToResult(`/subjects/${sub.id}`)}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-right text-sm text-ink transition-colors hover:bg-paper dark:text-paper dark:hover:bg-white/5"
                    >
                      {sub.title}
                    </button>
                  ))}
                </div>
              )}

              {results.homework.length > 0 && (
                <div className="px-1.5 pt-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-ink/40 dark:text-paper/40">
                    {categoryLabels.homework}
                  </div>
                  {results.homework.map((hw) => (
                    <button
                      key={hw.id}
                      onClick={() => goToResult(`/homework/${hw.id}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-sm text-ink transition-colors hover:bg-paper dark:text-paper dark:hover:bg-white/5"
                    >
                      <span>{hw.title}</span>
                      <span className="text-xs text-ink/40 dark:text-paper/40">{formatDate(hw.dueDate)}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.announcements.length > 0 && (
                <div className="px-1.5 pt-1 pb-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-ink/40 dark:text-paper/40">
                    {categoryLabels.announcements}
                  </div>
                  {results.announcements.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => goToResult(`/announcements/${a.id}`)}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-right text-sm text-ink transition-colors hover:bg-paper dark:text-paper dark:hover:bg-white/5"
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
