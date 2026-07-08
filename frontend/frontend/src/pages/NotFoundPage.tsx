import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <div className="tabular mb-2 text-5xl font-bold text-action">۴۰۴</div>
      <p className="mb-6 text-sm text-ink/60">صفحه‌ی مورد نظر پیدا نشد.</p>
      <Link to="/" className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90">
        بازگشت به داشبورد
      </Link>
    </div>
  );
}
