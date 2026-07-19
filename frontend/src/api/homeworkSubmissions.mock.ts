// ---------------------------------------------------------------------
// Homework submissions ("قسمت دریافت تکالیف") — TEMPORARY MOCK.
//
// Flagged as the most important part of the review ("خیلی مهم"): the
// teacher needs a list of student submissions per homework, the ability
// to download/preview each file (PDF or image), record a grade and a
// comment, and return a submission for revision.
//
// There is no submissions concept anywhere on the backend today —
// Homework is a one-way post from teacher to student/parent (see
// homework.entity.ts's own header comment). No StudentHomeworkSubmission
// entity, no student-facing upload endpoint. A real implementation needs
// a new entity + migration, a file-storage integration (the student-
// upload version of the same "store the reference, not the bytes"
// problem Homework.attachmentUrl already has), and new teacher-facing
// endpoints (e.g. GET /teacher/homework/:id/submissions, PATCH
// /teacher/homework/submissions/:id). All out of scope for this pass
// (frontend-only, per review).
//
// Seeded lazily per homeworkId on first read, so every homework row in
// the UI has a plausible, stable (for the current browser session) set
// of submissions to demo the review/grade/return workflow against.
// fileUrl values point at public placeholder assets (picsum for images,
// a public sample PDF) purely so the preview UI has something real to
// render — not meant to survive contact with a real backend.
//
// TODO(backend): once real submission endpoints exist, this file is the
// only thing that changes — hooks/useHomeworkExtras.ts's submission
// hooks already shape their inputs/outputs to match what a real
// GET/PATCH endpoint would plausibly return, so call sites (Teacher-
// HomeworkPage / HomeworkSubmissionsModal) need no changes.
// ---------------------------------------------------------------------

import type { HomeworkSubmission, SubmissionStatus } from '../types/homeworkExtras.types';

const MOCK_NETWORK_DELAY_MS = 300;

const MOCK_STUDENT_NAMES = [
  'آرمان کریمی',
  'ستایش رضایی',
  'پارسا احمدی',
  'هلیا موسوی',
  'رادین قاسمی',
  'باران نجفی',
];

const store = new Map<string, HomeworkSubmission[]>();

// Deterministic per-homeworkId "random" seed so the same homework always
// shows the same mock roster within a session, instead of reshuffling on
// every refetch.
function seedFrom(homeworkId: string): number {
  let seed = 0;
  for (let i = 0; i < homeworkId.length; i++) seed = (seed * 31 + homeworkId.charCodeAt(i)) >>> 0;
  return seed;
}

function seedSubmissions(homeworkId: string): HomeworkSubmission[] {
  const seed = seedFrom(homeworkId);
  const count = 2 + (seed % 4); // 2..5 دانش‌آموز
  const submissions: HomeworkSubmission[] = [];
  for (let i = 0; i < count; i++) {
    const isImage = (seed + i) % 2 === 0;
    const statusRoll = (seed + i * 7) % 5;
    const status: SubmissionStatus = statusRoll === 0 ? 'returned' : statusRoll <= 2 ? 'graded' : 'submitted';
    submissions.push({
      id: `${homeworkId}-sub-${i}`,
      homeworkId,
      studentId: `mock-student-${i}`,
      studentName: MOCK_STUDENT_NAMES[(seed + i) % MOCK_STUDENT_NAMES.length],
      fileName: isImage ? `پاسخ-تمرین-${i + 1}.jpg` : `پاسخ-تمرین-${i + 1}.pdf`,
      fileType: isImage ? 'image' : 'pdf',
      fileUrl: isImage
        ? `https://picsum.photos/seed/${homeworkId}-${i}/700/900`
        : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      submittedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
      status,
      grade: status === 'graded' ? 14 + ((seed + i) % 7) : null,
      comment: status === 'returned' ? 'لطفاً پاسخ سوال ۳ را دوباره بنویسید و بارگذاری کنید.' : null,
    });
  }
  return submissions;
}

export async function listSubmissions(homeworkId: string): Promise<HomeworkSubmission[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  if (!store.has(homeworkId)) {
    store.set(homeworkId, seedSubmissions(homeworkId));
  }
  return store.get(homeworkId)!;
}

function updateOne(submissionId: string, updater: (s: HomeworkSubmission) => HomeworkSubmission): HomeworkSubmission {
  for (const [homeworkId, list] of store.entries()) {
    const idx = list.findIndex((s) => s.id === submissionId);
    if (idx === -1) continue;
    const updated = updater(list[idx]);
    const next = [...list];
    next[idx] = updated;
    store.set(homeworkId, next);
    return updated;
  }
  throw new Error('ارسال مورد نظر یافت نشد.');
}

// ثبت نمره + ثبت نظر (یک عملیات؛ نظر اختیاری است).
export interface GradeSubmissionInput {
  submissionId: string;
  grade: number;
  comment?: string;
}

export async function gradeSubmission(input: GradeSubmissionInput): Promise<HomeworkSubmission> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return updateOne(input.submissionId, (s) => ({
    ...s,
    status: 'graded',
    grade: input.grade,
    comment: input.comment?.trim() ? input.comment.trim() : s.comment,
  }));
}

// برگرداندن برای اصلاح — نمره قبلی (اگر بود) پاک می‌شود، نظر الزامی است
// چون دانش‌آموز باید بداند چه چیزی را باید اصلاح کند.
export interface ReturnSubmissionInput {
  submissionId: string;
  comment: string;
}

export async function returnSubmissionForRevision(input: ReturnSubmissionInput): Promise<HomeworkSubmission> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return updateOne(input.submissionId, (s) => ({
    ...s,
    status: 'returned',
    grade: null,
    comment: input.comment.trim(),
  }));
}
