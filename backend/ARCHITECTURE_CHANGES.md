# معماری مالی جدید — خلاصه تحویل

این تحویل شامل ۶ ضعف معماری‌ای بود که روی‌شون توافق شد. همه پیاده‌سازی شدن، نه فقط طراحی.

## فایل‌های جدید
- `src/database/migrations/1736000000000-LedgerStateMachineIdempotency.ts` — جدول `financial_ledger`، حذف تریگر status، ایندکس یکتای شماره‌قسط، ستون‌های idempotency/void
- `src/modules/ledger/` — Ledger entity + service (append-only، فقط insert)
- `src/modules/tuition/state-machine/installment-state-machine.ts` — قوانین صریح انتقال وضعیت
- `src/common/events/domain-events.ts` — کلاس‌های Domain Event
- `src/common/authorization/` — Permission، Guard، Decorator برای مجوز دقیق‌تر از role خام
- `src/modules/notifications/payment-events.listener.ts` — اتصال Notification به رویدادها

## فایل‌های بازنویسی‌شده
`payments.service.ts` (idempotency + void + ledger + state machine)، `tuition-plans.service.ts` (ledger charge + سقف تخفیف)، `installments.service.ts` (state machine + override endpoint)، `reports.service.ts` (گزارش درآمد ماهانه و بدهکاران از روی ledger)، کنترلرها و ماژول‌های مرتبط، `app.module.ts` (EventEmitterModule سراسری).

## قدم بعدی برای اجرا واقعی
1. `npm install @nestjs/event-emitter` (به package.json اضافه شده، فقط باید نصب بشه)
2. `npm run migration:run`
3. تست دستی: ثبت پرداخت با یک `idempotencyKey` دوبار → باید یک payment بسازه نه دوتا
4. تست void: `DELETE /payments/:id` با body `{ "reason": "..." }` → باید وضعیت قسط برگرده و یه ردیف VOID تو ledger ثبت بشه

## چیزی که عمداً نصفه‌کاره موند
Tenant enforcement هنوز per-service چک می‌شه (نه یک Guard/Interceptor سراسری که خودکار همه query هارو محدود کنه) — این یک تغییر ساختاری بزرگ‌تره (نیاز به base repository یا AsyncLocalStorage برای context) و به‌عمد از این تحویل بیرون گذاشته شد که حجم قابل‌مرور بمونه. اگه خواستی به‌عنوان قدم بعدی جداگانه انجامش می‌دیم.
