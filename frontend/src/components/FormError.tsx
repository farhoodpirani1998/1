import type { ParsedApiError } from '../lib/error-handler';

// Renders parseApiError()'s output. Each error kind gets its own label
// and color so a permission error doesn't look identical to a validation
// typo or a dropped network connection — the whole point of Phase 3.
const KIND_STYLES: Record<ParsedApiError['kind'], string> = {
  validation: 'bg-warning/10 text-warning border-warning/30',
  permission: 'bg-overdue/10 text-overdue border-overdue/30',
  auth: 'bg-overdue/10 text-overdue border-overdue/30',
  notFound: 'bg-ink/5 text-ink/70 border-ink/20',
  conflict: 'bg-overdue/10 text-overdue border-overdue/30',
  network: 'bg-navy/10 text-navy border-navy/30',
  server: 'bg-overdue/10 text-overdue border-overdue/30',
  unknown: 'bg-overdue/10 text-overdue border-overdue/30',
};

const KIND_LABELS: Record<ParsedApiError['kind'], string> = {
  validation: 'خطای اعتبارسنجی',
  permission: 'عدم دسترسی',
  auth: 'نشست منقضی شده',
  notFound: 'یافت نشد',
  conflict: 'تناقض داده',
  network: 'خطای ارتباط',
  server: 'خطای سرور',
  unknown: 'خطا',
};

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function FormError({ error }: { error: ParsedApiError | null }) {
  if (!error) return null;
  return (
    <div className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${KIND_STYLES[error.kind]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold opacity-90">
        <ErrorIcon />
        {KIND_LABELS[error.kind]}
      </div>
      {error.messages.length === 1 ? (
        <div className="pr-[19px]">{error.messages[0]}</div>
      ) : (
        <ul className="list-disc space-y-0.5 pr-[26px]">
          {error.messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
