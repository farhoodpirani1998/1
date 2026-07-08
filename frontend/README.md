# پنل مدیریت مدرسه (فرانت‌اند)

React + Vite + TypeScript + Tailwind. برای اجرا نیاز به بک‌اند NestJS (پروژه‌ی جدا) روی پورت ۳۰۰۰ دارد.

## اجرا

```bash
npm install
npm run dev
```

پیش‌فرض روی `http://localhost:5173` بالا می‌آید و درخواست‌های `/api/*` را (طبق `vite.config.ts`) به `http://localhost:3000` پروکسی می‌کند — یعنی در حالت dev نیازی به تنظیم آدرس جدا نیست.

## برای build نهایی (production)

چون در build نهایی پروکسی Vite وجود ندارد، باید `src/lib/api.ts` را طوری تغییر بدی که `baseURL` را از یک متغیر محیطی (`VITE_API_BASE_URL`) بخواند، یا بک‌اند و فرانت را پشت یک reverse proxy مشترک (nginx) قرار بدی.

## ساختار

- `src/lib/api.ts` — کلاینت axios با JWT خودکار
- `src/lib/auth.tsx` — Context لاگین/خروج
- `src/pages/` — صفحات (Dashboard, Students, StudentDetail, Login)
- `src/components/` — Sidebar, Topbar, Card, StatusBadge, AppLayout

## نکته‌ی مهم برای توسعه‌ی بعدی

وقتی حضور‌وغیاب و نمرات رو اضافه کنی، پیشنهاد می‌کنم همون الگوی فعلی رو ادامه بدی: هر بخش یک پوشه‌ی مستقل در `pages/` + type متناظرش در `lib/types.ts`، بدون نیاز به تغییر ساختار کلی.
