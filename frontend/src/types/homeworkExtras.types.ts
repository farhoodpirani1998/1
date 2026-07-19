// ---------------------------------------------------------------------
// MOCK-ONLY extension of Homework (see api/homeworkExtras.mock.ts and
// api/homeworkSubmissions.mock.ts header comments for why these are
// mocked rather than real DTO/entity fields).
//
// Kept as its own file, separate from api/teacher.api.ts's HomeworkView,
// so it's obvious at every import site which fields are real (persisted
// via POST/PUT /teacher/homework) and which are mock-only (kept in
// browser memory, lost on reload) until a real backend field exists for
// each — see the TODO(backend) note in both mock files.
// ---------------------------------------------------------------------

// دیده‌شده در فیدبک: «زمان تحویل / ساعت تحویل / بارگذاری فایل / حداکثر
// حجم فایل / نوع فایل مجاز / امتیاز / نمایش برای والدین / نمایش برای
// دانش‌آموز / انتشار زمان‌بندی‌شده».
export interface HomeworkExtras {
  // ساعت تحویل — HomeworkView.dueDate already carries the *date*
  // ('YYYY-MM-DD'); this is the time-of-day on that same date. 'HH:MM'
  // or null (no specific hour, deadline is end-of-day).
  dueTime: string | null;
  // بارگذاری فایل توسط معلم — امروز فقط attachmentUrl (لینک) واقعی است؛
  // این صرفاً نام/حجم فایلی که معلم در مرورگر انتخاب کرده را نگه
  // می‌دارد، هیچ آپلود واقعی‌ای رخ نمی‌دهد.
  teacherUploadedFileName: string | null;
  teacherUploadedFileSizeKb: number | null;
  // حداکثر حجم فایل مجاز برای بارگذاری دانش‌آموز، بر حسب مگابایت.
  maxFileSizeMb: number | null;
  // نوع فایل‌های مجاز برای بارگذاری دانش‌آموز، مثل ['pdf', 'jpg', 'png'].
  allowedFileTypes: string[];
  // امتیاز
  points: number | null;
  // نمایش برای والدین / نمایش برای دانش‌آموز
  visibleToParent: boolean;
  visibleToStudent: boolean;
  // انتشار زمان‌بندی‌شده — تاریخ/ساعت ISO که تکلیف باید نمایان شود؛
  // null یعنی بلافاصله پس از ثبت نمایان است.
  scheduledPublishAt: string | null;
}

export const DEFAULT_HOMEWORK_EXTRAS: HomeworkExtras = {
  dueTime: null,
  teacherUploadedFileName: null,
  teacherUploadedFileSizeKb: null,
  maxFileSizeMb: 10,
  allowedFileTypes: ['pdf', 'jpg', 'png'],
  points: null,
  visibleToParent: true,
  visibleToStudent: true,
  scheduledPublishAt: null,
};

// «قسمت دریافت تکالیف» — بخشی که در فیدبک «خیلی مهم» علامت خورده.
export type SubmissionStatus = 'submitted' | 'graded' | 'returned';

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  // آدرس نمایشی برای پیش‌نمایش/دانلود — در نسخه Mock به فایل واقعی
  // دانش‌آموز اشاره نمی‌کند، صرفاً برای نمایش رفتار UI است.
  fileUrl: string;
  submittedAt: string; // ISO
  status: SubmissionStatus;
  grade: number | null;
  comment: string | null;
}
