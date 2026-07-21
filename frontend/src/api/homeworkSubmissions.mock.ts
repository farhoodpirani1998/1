// ---------------------------------------------------------------------
// Homework submissions ("قسمت دریافت تکالیف").
//
// Sprint H3.0 update: listing + grading are now REAL, backed by
// GET /teacher/homework/:id/submissions and
// PATCH /teacher/homework/submissions/:submissionId (see
// api/teacher.api.ts). This file is kept (name unchanged, despite the
// ".mock" suffix) purely so hooks/useHomeworkExtras.ts and every call
// site (HomeworkSubmissionsModal / TeacherHomeworkPage) need no changes
// — it now merges real submission rows with two things the backend still
// does not have, by explicit product decision for this pass:
//
// 1. File preview/download (fileName/fileType/fileUrl) — the backend
//    has NO file-storage column at all (SubmitHomeworkDto is an empty
//    body). Kept fully mocked/deterministic per submission id, same
//    placeholder assets as before. TODO(backend): once a real upload
//    endpoint + fileUrl column exist, replace seedFileFor() below with
//    the real field from TeacherHomeworkSubmissionView.
//
// 2. "Return for revision" — HomeworkSubmissionStatus has no `returned`
//    value and there is no endpoint for it; only score+feedback grading
//    exists. Kept as a purely local, in-memory override (lost on
//    reload, never sent to the backend) layered on top of the real
//    status/score/feedback. TODO(backend): once a real status/endpoint
//    exists for this, replace returnSubmissionForRevision() below with
//    a real API call the same way gradeSubmission() already was.
//
// Real grading (gradeSubmission) clears any local "returned" override
// for that submission, since a fresh grade supersedes it.
// ---------------------------------------------------------------------

import { getMyHomeworkSubmissions, gradeMyHomeworkSubmission } from './teacher.api';
import type { HomeworkSubmission, SubmissionStatus } from '../types/homeworkExtras.types';

const MOCK_STUDENT_NAMES = [
  'آرمان کریمی',
  'ستایش رضایی',
  'پارسا احمدی',
  'هلیا موسوی',
  'رادین قاسمی',
  'باران نجفی',
];

// Deterministic per-id "random" seed — same approach the old fully-mock
// version used, just keyed on the real submission id now instead of a
// synthetic one.
function seedFrom(id: string): number {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  return seed;
}

// Local-only placeholder file data. Not real — see file header.
function seedFileFor(submissionId: string): Pick<HomeworkSubmission, 'fileName' | 'fileType' | 'fileUrl'> {
  const seed = seedFrom(submissionId);
  const isImage = seed % 2 === 0;
  return {
    fileName: isImage ? 'پاسخ-تمرین.jpg' : 'پاسخ-تمرین.pdf',
    fileType: isImage ? 'image' : 'pdf',
    fileUrl: isImage
      ? `https://picsum.photos/seed/${submissionId}/700/900`
      : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  };
}

// Local-only "returned for revision" overrides — see file header, item 2.
// Not persisted anywhere real; lost on reload, never synced across
// teacher/student/parent.
const returnedOverrides = new Map<string, { comment: string }>();

// Small cache of the last real row seen per submission id, so
// returnSubmissionForRevision() (which only receives a submissionId, no
// homeworkId — see its own signature/ReturnSubmissionInput) can
// re-derive studentName/submittedAt without a second network round trip
// or a homeworkId it was never given. Populated by listSubmissions();
// always fresh by the time a user can click "return" on a row, since
// that row had to be rendered from a prior listSubmissions() call first.
const rowCache = new Map<string, HomeworkSubmission>();

export async function listSubmissions(homeworkId: string): Promise<HomeworkSubmission[]> {
  const { data } = await getMyHomeworkSubmissions(homeworkId);
  // Only rows the student has actually turned something in for (or that
  // are already graded) belong in this "ارسال‌ها" list — a `pending`/
  // `missing` row with nothing submitted has nothing to review yet.
  const rows = data
    .filter((row) => row.submittedAt !== null || row.gradedAt !== null)
    .map((row): HomeworkSubmission => {
      const override = returnedOverrides.get(row.id);
      const status: SubmissionStatus = override ? 'returned' : row.gradedAt ? 'graded' : 'submitted';
      return {
        id: row.id,
        homeworkId: row.homeworkId,
        studentId: row.studentId,
        studentName: row.studentName ?? MOCK_STUDENT_NAMES[seedFrom(row.id) % MOCK_STUDENT_NAMES.length],
        submittedAt: row.submittedAt ?? row.createdAt,
        status,
        grade: override ? null : row.score,
        comment: override ? override.comment : row.feedback,
        ...seedFileFor(row.id),
      };
    });
  rows.forEach((row) => rowCache.set(row.id, row));
  return rows;
}

// ثبت نمره + ثبت نظر (یک عملیات؛ نظر اختیاری است) — حالا واقعی است.
export interface GradeSubmissionInput {
  submissionId: string;
  grade: number;
  comment?: string;
}

export async function gradeSubmission(input: GradeSubmissionInput): Promise<HomeworkSubmission> {
  const { data } = await gradeMyHomeworkSubmission(input.submissionId, {
    score: input.grade,
    feedback: input.comment,
  });
  // A fresh real grade supersedes any local "returned" state.
  returnedOverrides.delete(input.submissionId);
  const cached = rowCache.get(input.submissionId);
  const updated: HomeworkSubmission = {
    id: data.id,
    homeworkId: data.homeworkId,
    studentId: data.studentId,
    studentName: data.studentName ?? cached?.studentName ?? MOCK_STUDENT_NAMES[seedFrom(data.id) % MOCK_STUDENT_NAMES.length],
    submittedAt: data.submittedAt ?? cached?.submittedAt ?? data.createdAt,
    status: 'graded',
    grade: data.score,
    comment: data.feedback,
    ...seedFileFor(data.id),
  };
  rowCache.set(updated.id, updated);
  return updated;
}

// برگرداندن برای اصلاح — LOCAL/MOCK ONLY, به بک‌اند ارسال نمی‌شود (بک‌اند
// چنین وضعیت یا endpoint‌ای ندارد؛ تصمیم صریح برای این پاس). نمره واقعی
// قبلی دست‌نخورده در بک‌اند می‌ماند و با اولین grade واقعی بعدی، override
// پاک می‌شود.
export interface ReturnSubmissionInput {
  submissionId: string;
  comment: string;
}

export async function returnSubmissionForRevision(input: ReturnSubmissionInput): Promise<HomeworkSubmission> {
  const comment = input.comment.trim();
  returnedOverrides.set(input.submissionId, { comment });
  const cached = rowCache.get(input.submissionId);
  if (!cached) {
    // Shouldn't happen in practice — a row must have come through
    // listSubmissions() (and so been cached) before a "return" action
    // can be clicked on it in the UI — but fail loudly rather than
    // silently fabricate studentName/submittedAt if it ever does.
    throw new Error('ارسال مورد نظر یافت نشد.');
  }
  const updated: HomeworkSubmission = { ...cached, status: 'returned', grade: null, comment };
  rowCache.set(updated.id, updated);
  return updated;
}
