import * as React from "react";

/**
 * ست آیکون سفارشی پنل مدیریت مدرسه
 * ------------------------------------------------------------
 * جهت‌گیری بصری انتخاب‌شده: گزینه ۲ — Outline هندسی با لهجه مالی/رسمی.
 * امضای بصری مشترک (signature): به‌جای گوشه‌ی کاملاً گرد یا کاملاً تیز، شکل‌های
 * مستطیلی/کارتی (فاکتور، کارت پرداخت، تقویم، کاشی‌های داشبورد و...) یک گوشه‌ی
 * "چمفر ۴۵ درجه" (cut corner) دارند — دقیقاً مثل گوشه‌ی تاشده‌ی رسید یا فاکتور
 * کاغذی. این یک جزئیات هندسی تکرارشونده‌ست که حس "مالی/اداری" رسمی می‌ده، نه
 * بازیگوش، و در عین حال با استروک‌های round-cap/round-join نرم باقی می‌مونه.
 *
 * الزامات فنی:
 * - viewBox ثابت 0 0 24 24
 * - stroke="currentColor" / fill="none" (duotone فقط برای وضعیت پرداخت با اپاسیتی کم)
 * - strokeWidth پارامتری، پیش‌فرض ۱.۷۵ برای کل ست
 * - size پراپ اختیاری، پیش‌فرض ۲۰، هم روی width هم height
 * - بدون رنگ هاردکد؛ رنگ‌دهی وضعیت از بیرون با کلاس‌های text-*
 */

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** اندازه‌ی آیکون بر حسب پیکسل (هم width هم height). پیش‌فرض: 20 */
  size?: number;
  /** ضخامت خط. پیش‌فرض: 1.75 برای هماهنگی با بقیه‌ی ست */
  strokeWidth?: number;
}

const base = (
  props: IconProps,
  children: React.ReactNode
): React.ReactElement => {
  const { size = 20, strokeWidth = 1.75, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* مالی / شهریه                                                        */
/* ------------------------------------------------------------------ */

/** فاکتور شهریه: برگه‌ی سند با گوشه‌ی چمفرشده‌ی بالا-راست و خطوط متن */
export const TuitionIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M15 3v3h3" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15.5h7" />
      <path d="M8.5 19h4" />
    </>
  );

/** پرداخت‌ها: کارت پرداخت با گوشه‌ی چمفر و نوار مغناطیسی */
export const PaymentsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3 7a1 1 0 0 1 1-1h14l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M18 6v3h3" />
      <path d="M3 11h18" />
      <path d="M6.5 15h4" />
    </>
  );

/** اقساط: پله‌های صعودی نشان‌دهنده‌ی پرداخت مرحله‌ای */
export const InstallmentsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3.5 19.5h4v-4h-4Z" />
      <path d="M9.5 19.5h4v-8h-4Z" />
      <path d="M15.5 19.5h4v-12h-4Z" />
      <path d="M3.5 19.5h16" />
    </>
  );

/** مانده حساب: ترازو ساده و هندسی */
export const BalanceIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 3v3" />
      <path d="M6 6h12" />
      <path d="M6 6 3 12.5a3 3 0 0 0 6 0Z" />
      <path d="M18 6l-3 6.5a3 3 0 0 0 6 0Z" />
      <path d="M9 21h6" />
      <path d="M12 9v12" />
    </>
  );

/** پرداخت‌شده: سند با مهر تیک داخل دایره (duotone سبک روی مهر) */
export const PaidIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M5 3h9l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v3h3" />
      <path d="M7.5 12h4" />
      <path d="M7.5 15h3" />
      <circle cx="16.5" cy="16.5" r="4" fill="currentColor" fillOpacity="0.12" />
      <path d="M14.7 16.5l1.2 1.2 2.1-2.4" />
    </>
  );

/* ------------------------------------------------------------------ */
/* افراد                                                               */
/* ------------------------------------------------------------------ */

/** دانش‌آموز: سر + کلاه فارغ‌التحصیلی هندسی */
export const StudentIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="12" cy="10" r="3.2" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M8.5 9.5 12 8l3.5 1.5-3.5 1.5Z" />
      <path d="M9 10.3v2.1c0 .7 1.3 1.3 3 1.3s3-.6 3-1.3v-2.1" />
    </>
  );

/** دانش‌آموزان: دو نفر هم‌پوشان با یک کلاه مشترک کوچک */
export const StudentsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="9" cy="9.5" r="2.8" />
      <path d="M3.5 20a5.7 5.7 0 0 1 11 0" />
      <path d="M15 6.8a2.6 2.6 0 1 1 0 5.2" />
      <path d="M16 20a5.2 5.2 0 0 0-3-4.7" />
    </>
  );

/** معلم: فرد + تخته‌ی کوچک کنار */
export const TeacherIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20a5.4 5.4 0 0 1 10 0" />
      <path d="M16 6h5v6h-5Z" />
      <path d="M17.3 9h2.4" />
    </>
  );

/** کاربران عمومی: دو نفر هم‌پوشان کلاسیک */
export const UsersIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="8.5" cy="8.5" r="3" />
      <path d="M3 20a5.6 5.6 0 0 1 11 0" />
      <path d="M14.5 6.2a2.7 2.7 0 1 1 0 5.4" />
      <path d="M15.5 20a5.1 5.1 0 0 0-2.8-4.6" />
    </>
  );

/* ------------------------------------------------------------------ */
/* تحصیلی                                                              */
/* ------------------------------------------------------------------ */

/** کلاس: تخته‌ی وایت‌برد روی پایه */
export const ClassIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3.5 4h15a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 20l1.5-3.5" />
      <path d="M16 20l-1.5-3.5" />
      <path d="M7 8l4 3 3-2 3 2.5" />
    </>
  );

/** درس/مبحث: کتاب باز با شیرازه‌ی وسط */
export const SubjectIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 6.5c-1.6-1-3.6-1.5-5.5-1.5A2.5 2.5 0 0 0 4 7.5v11c1.9 0 3.9.4 5.5 1.4.8.5 1.7.5 2.5 0 1.6-1 3.6-1.4 5.5-1.4v-11A2.5 2.5 0 0 0 15.5 5c-1.9 0-3.9.5-5.5 1.5Z" />
      <path d="M12 6.5V19" />
    </>
  );

/** نمرات: نمودار میله‌ای صعودی داخل قاب */
export const ScoreIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3.5 20.5v-15" />
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-5" />
      <path d="M11.5 20.5v-9" />
      <path d="M16 20.5v-4" />
      <path d="M20 20.5v-11" />
    </>
  );

/** تکالیف: کلیپ‌بورد با کلیپ بالا و خطوط متن */
export const AssignmentsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M9.5 3.5h5a1 1 0 0 1 1 1V6h-7V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14.5h7" />
      <path d="M8.5 18h4.5" />
    </>
  );

/** حضور و غیاب: تقویم با تیک */
export const AttendanceIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M4.5 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8 3v3.5" />
      <path d="M15.5 3v3.5" />
      <path d="M3.5 9.5h14" />
      <path d="M9 14l2 2 3.5-3.5" />
    </>
  );

/** اعلان‌ها: زنگوله با نقطه‌ی کوچک برای نشان‌دادن اعلان تازه، هماهنگ با ست */
export const NotificationIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 3.1 1 4.7 1.8 5.6a1 1 0 0 1-.8 1.6H5a1 1 0 0 1-.8-1.6C5 14.7 6 13.1 6 10Z" />
      <path d="M9.5 17.2a2.6 2.6 0 0 0 5 0" />
      <circle cx="17.5" cy="6.2" r="2.4" fill="currentColor" fillOpacity="0.15" />
    </>
  );

/** پیام: حباب گفتگو با گوشه‌ی چمفرشده — برای پیام‌های والدین */
export const MessageIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M4 5.5h13.5a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
      <path d="M7 9.5h8" />
      <path d="M7 12.5h5" />
    </>
  );

/** فعالیت اخیر: ساعت با فلش برگشتی به دور آن، برای نمای تایم‌لاین */
export const HistoryIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 7.5V12l3 2" />
      <path d="M4.5 12a7.5 7.5 0 1 1 2.4 5.5" />
      <path d="M3 8v3.5h3.5" />
    </>
  );

/* ------------------------------------------------------------------ */
/* ناوبری / عمومی                                                      */
/* ------------------------------------------------------------------ */

/** داشبورد: چهار کاشی نامساوی، یکی با گوشه‌ی چمفر برای امضای ست */
export const DashboardIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3.5 3.5h8v6.5h-8Z" />
      <path d="M13.5 3.5h7v3.5l-3 3h-4Z" />
      <path d="M3.5 12h5v8.5h-5Z" />
      <path d="M10.5 15h10v5.5h-10Z" />
    </>
  );

/** گزارش‌ها: سند با نمودار میله‌ای کوچک داخلش */
export const ReportsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8 17v-3" />
      <path d="M11.3 17v-5" />
      <path d="M14.6 17v-2" />
    </>
  );

/** مدرسه: نمای ساختمان با سقف مثلثی و ستون‌ها */
export const SchoolIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 3 3 8.5V10h18V8.5Z" />
      <path d="M4.5 10v9.5" />
      <path d="M19.5 10v9.5" />
      <path d="M4 20h16" />
      <path d="M8 13v5" />
      <path d="M12 13v5" />
      <path d="M16 13v5" />
    </>
  );

/** مدرسه‌ها (چند مدرسه): دو ساختمان هم‌پوشان */
export const SchoolsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M9 4 3 7.8V9h12V7.8Z" />
      <path d="M4 9v8.5" />
      <path d="M11 9v8.5" />
      <path d="M3 17.5h9" />
      <path d="M15 8l4.5 2.6V12h-6" />
      <path d="M13.5 21v-6.5h6V21" />
      <path d="M11.5 21h9" />
    </>
  );

/** تنظیمات: مهره‌ی شش‌ضلعی به‌جای دنده‌ی کلاسیک — هماهنگ با لهجه‌ی زاویه‌دار ست */
export const SettingsIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 2.5 20 7v10L12 21.5 4 17V7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  );

/** تقویم: قاب تقویم با تب‌های بالا، هماهنگ با AttendanceIcon */
export const CalendarIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M4.5 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8 3v3.5" />
      <path d="M15.5 3v3.5" />
      <path d="M3.5 9.5h14" />
      <path d="M8 13.5h.01" />
      <path d="M12 13.5h.01" />
      <path d="M16 13.5h.01" />
      <path d="M8 17h.01" />
      <path d="M12 17h.01" />
    </>
  );

/** لیست: خطوط افقی با نشانگرهای مربعی کوچک سمت راست (RTL) */
export const ListIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M18.5 6h-3" />
      <path d="M18.5 12h-3" />
      <path d="M18.5 18h-3" />
      <path d="M9 6h9.5" />
      <path d="M9 12h9.5" />
      <path d="M9 18h9.5" />
      <path d="M4.75 5.25h.5v.5h-.5Z" />
      <path d="M4.75 11.25h.5v.5h-.5Z" />
      <path d="M4.75 17.25h.5v.5h-.5Z" />
    </>
  );

/** هدف: دایره‌های هم‌مرکز با یک نقطه‌ی کانونی */
export const TargetIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </>
  );

/* ------------------------------------------------------------------ */
/* وضعیت / فیدبک                                                       */
/* ------------------------------------------------------------------ */

/** تأیید: دایره با تیک — برای استفاده با text-emerald-* از بیرون */
export const CheckIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 5-5.2" />
    </>
  );

/** هشدار: مثلث با گوشه‌ی چمفرشده‌ی بالا (نه گوشه‌ی تیز کلاسیک) + علامت تعجب */
export const AlertIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 3.5 20.5 18.5a1 1 0 0 1-.87 1.5H4.37a1 1 0 0 1-.87-1.5Z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.7h.01" />
    </>
  );

/** خطا: هشت‌ضلعی (stop-shape) با ضربدر داخل — سازگار با لهجه‌ی هندسی ست */
export const ErrorIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M8 3.5h8L20.5 8v8L16 20.5H8L3.5 16V8Z" />
      <path d="M9.5 9.5l5 5" />
      <path d="M14.5 9.5l-5 5" />
    </>
  );

/** پیکان ورود (RTL): برای دکمه‌های "ورود به..."/ناوبری به جلو در چیدمان راست‌به‌چپ */
export const ChevronEnterIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M14.5 6.5 8 12l6.5 5.5" />
    </>
  );

/** حالت خالی (بدون داده): جعبه‌ی باز با گوشه‌ی چمفر و یک نقطه‌ی محو داخلش */
export const DefaultIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3.5 9.5 12 6l8.5 3.5V17L12 20.5 3.5 17Z" />
      <path d="M3.5 9.5 12 13l8.5-3.5" />
      <path d="M12 13v7.5" />
      <circle cx="12" cy="9.7" r="0.9" fill="currentColor" fillOpacity="0.35" stroke="none" />
    </>
  );

/* ------------------------------------------------------------------ */
/* ناوبری گروهی (سایدبار)                                              */
/* ------------------------------------------------------------------ */

/** شورون رو به پایین: برای بازشو/جمع‌شوی گروه‌های ناوبری */
export const ChevronDownIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6 9.5 12 15l6-5.5" />
    </>
  );

/** قفل: برای موارد ناوبری غیرفعال/به‌زودی که هنوز صفحه‌ای ندارند */
export const LockIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6.5 10.5h11a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
      <circle cx="12" cy="14.7" r="1.2" fill="currentColor" fillOpacity="0.3" />
    </>
  );
