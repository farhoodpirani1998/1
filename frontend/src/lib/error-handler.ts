import axios from 'axios';

// Backend's global exception filter (common/filters/http-exception.filter.ts)
// always responds with this shape, whatever throws the error:
//   { statusCode: number, message: string | string[], path, timestamp }
// - `message` is a STRING when a service throws deliberately
//   (NotFoundException/ForbiddenException/ConflictException etc.) — the
//   backend already writes these in Persian (e.g. "قسط یافت نشد"), so
//   they're shown as-is.
// - `message` is an ARRAY only for class-validator's default
//   ValidationPipe failures (main.ts), and those come out in English
//   ("amount must be positive") — this is the part that actually needs
//   translating.
interface BackendErrorBody {
  statusCode?: number;
  message?: string | string[];
  path?: string;
  timestamp?: string;
}

export type ErrorKind = 'validation' | 'permission' | 'auth' | 'notFound' | 'conflict' | 'network' | 'server' | 'unknown';

export interface ParsedApiError {
  kind: ErrorKind;
  // Validation errors can carry one message per invalid field; every
  // other kind resolves to a single message but still returns an array
  // for a uniform shape at call sites.
  messages: string[];
}

// Persian labels for DTO field names that appear across the app's forms
// (payments, students, tuition plans, academic years, grades, schools,
// users). Keep in sync with the DTOs in api/*.ts if new fields are added.
const FIELD_LABELS: Record<string, string> = {
  amount: 'مبلغ',
  paymentMethod: 'روش پرداخت',
  referenceNumber: 'شماره پیگیری',
  paidAt: 'تاریخ پرداخت',
  note: 'یادداشت',
  idempotencyKey: 'کلید یکتای درخواست',
  reason: 'دلیل',
  fullName: 'نام و نام خانوادگی',
  phone: 'شماره تلفن',
  password: 'رمز عبور',
  nationalId: 'کد ملی',
  enrollmentDate: 'تاریخ ثبت‌نام',
  gradeId: 'پایه تحصیلی',
  academicYearId: 'سال تحصیلی',
  studentId: 'دانش‌آموز',
  guardianId: 'والد',
  newGuardian: 'اطلاعات والد',
  baseAmount: 'شهریه پایه',
  discountAmount: 'مبلغ تخفیف',
  discountReason: 'دلیل تخفیف',
  count: 'تعداد اقساط',
  startDate: 'تاریخ شروع',
  intervalDays: 'فاصله اقساط',
  title: 'عنوان',
  endDate: 'تاریخ پایان',
  isCurrent: 'سال جاری',
  name: 'نام',
  address: 'آدرس',
  isActive: 'وضعیت فعال',
  role: 'نقش',
  schoolId: 'مدرسه',
  status: 'وضعیت',
  teacherId: 'معلم',
  subjectId: 'درس',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// Matches the *shape* of class-validator's default English messages, not
// exact strings (it interpolates the property name in) — see main.ts's
// ValidationPipe. Order matters: more specific patterns first.
const VALIDATION_PATTERNS: { pattern: RegExp; translate: (...groups: string[]) => string }[] = [
  { pattern: /^(.+) must be a positive number$/, translate: (f) => `${fieldLabel(f)} باید عددی مثبت باشد` },
  { pattern: /^(.+) must not be less than (\d+)$/, translate: (f, n) => `${fieldLabel(f)} نباید کمتر از ${n} باشد` },
  { pattern: /^(.+) must not be greater than (\d+)$/, translate: (f, n) => `${fieldLabel(f)} نباید بیشتر از ${n} باشد` },
  { pattern: /^(.+) must be a number conforming to the specified constraints$/, translate: (f) => `${fieldLabel(f)} باید عدد باشد` },
  { pattern: /^(.+) must be an integer number$/, translate: (f) => `${fieldLabel(f)} باید عدد صحیح باشد` },
  { pattern: /^(.+) must be a string$/, translate: (f) => `${fieldLabel(f)} باید متن باشد` },
  { pattern: /^(.+) should not be empty$/, translate: (f) => `${fieldLabel(f)} نباید خالی باشد` },
  { pattern: /^(.+) must be shorter than or equal to (\d+) characters$/, translate: (f, n) => `${fieldLabel(f)} باید حداکثر ${n} کاراکتر باشد` },
  { pattern: /^(.+) must be longer than or equal to (\d+) characters$/, translate: (f, n) => `${fieldLabel(f)} باید حداقل ${n} کاراکتر باشد` },
  { pattern: /^(.+) must be one of the following values: .+$/, translate: (f) => `مقدار ${fieldLabel(f)} معتبر نیست` },
  { pattern: /^(.+) must be a valid enum value$/, translate: (f) => `مقدار ${fieldLabel(f)} معتبر نیست` },
  { pattern: /^(.+) must be a valid ISO 8601 date string$/, translate: (f) => `${fieldLabel(f)} باید یک تاریخ معتبر باشد` },
  { pattern: /^(.+) must be a UUID$/, translate: (f) => `${fieldLabel(f)} نامعتبر است` },
  { pattern: /^(.+) must be a boolean value$/, translate: (f) => `${fieldLabel(f)} باید درست یا نادرست باشد` },
  { pattern: /^(.+) should not exist$/, translate: (f) => `فیلد غیرمجاز «${fieldLabel(f)}» ارسال شده است` },
  { pattern: /^(.+) must be a phone number$/, translate: (f) => `${fieldLabel(f)} معتبر نیست` },
];

function translateValidationMessage(raw: string): string {
  for (const { pattern, translate } of VALIDATION_PATTERNS) {
    const match = raw.match(pattern);
    if (match) return translate(...match.slice(1));
  }
  // No pattern matched (a DTO rule this file doesn't know about yet) —
  // surface the raw text rather than silently swallowing it.
  return raw;
}

export function parseApiError(error: unknown): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    return { kind: 'unknown', messages: ['خطای غیرمنتظره‌ای رخ داد'] };
  }

  if (!error.response) {
    return { kind: 'network', messages: ['ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.'] };
  }

  const { status, data } = error.response as { status: number; data?: BackendErrorBody };
  const rawMessage = data?.message;

  switch (status) {
    case 401:
      // Two different situations share this status: (1) a login attempt
      // with wrong credentials — AuthService already throws a specific,
      // correct Persian message ("شماره تلفن یا رمز عبور اشتباه است")
      // for this, which must win here; (2) an expired/invalid token on
      // an already-authenticated request, which carries no useful
      // backend message and is about to trigger the axios interceptor's
      // redirect to /login (see lib/api.ts) — that case falls back to a
      // generic notice.
      return {
        kind: 'auth',
        messages: [typeof rawMessage === 'string' ? rawMessage : 'نشست شما منقضی شده است. در حال انتقال به صفحه ورود...'],
      };
    case 403:
      return {
        kind: 'permission',
        messages: [typeof rawMessage === 'string' ? rawMessage : 'شما اجازه‌ی انجام این عملیات را ندارید.'],
      };
    case 404:
      return {
        kind: 'notFound',
        messages: [typeof rawMessage === 'string' ? rawMessage : 'مورد مورد نظر یافت نشد.'],
      };
    case 409:
      return {
        kind: 'conflict',
        messages: [typeof rawMessage === 'string' ? rawMessage : 'این عملیات با اطلاعات موجود در تناقض است.'],
      };
    case 400: {
      const messages = Array.isArray(rawMessage)
        ? rawMessage.map(translateValidationMessage)
        : [typeof rawMessage === 'string' ? rawMessage : 'اطلاعات ارسالی نامعتبر است.'];
      return { kind: 'validation', messages };
    }
    default:
      if (status >= 500) {
        return {
          kind: 'server',
          // The backend never sends internal error detail to the client
          // for real 500s (see http-exception.filter.ts) — rawMessage
          // here is already its own Persian fallback string.
          messages: [typeof rawMessage === 'string' ? rawMessage : 'خطای داخلی سرور رخ داده است.'],
        };
      }
      return { kind: 'unknown', messages: [typeof rawMessage === 'string' ? rawMessage : 'خطایی رخ داد.'] };
  }
}

// Convenience for call sites that just want one line (e.g. a toast) —
// joins multiple validation messages rather than picking only the first.
export function getErrorMessage(error: unknown): string {
  return parseApiError(error).messages.join(' • ');
}
