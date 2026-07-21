import { HomeworkSubmission } from '../../homework/entities/homework-submission.entity';

// Sprint A.3.3 — GET /teacher/homework/:id/submissions: the raw
// submission rows HomeworkSubmissionService.findForHomework() already
// returns, reshaped the same "don't leak the ORM entity as-is" way
// toAttendanceView / toAssessmentView do -- studentName is only
// populated because HomeworkSubmissionService's SUBMISSION_RELATIONS
// already eager-loads it, not re-fetched here.
export interface TeacherHomeworkSubmissionView {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName?: string;
  status: string;
  submittedAt: Date | null;
  // Sprint H3.0 — additive: null on every submission that hasn't been
  // graded yet, same "unset until the thing it names has actually
  // happened" shape as submittedAt above. Every field that already
  // existed on this view is unchanged, so no existing caller of
  // GET /teacher/homework/:id/submissions breaks.
  score: number | null;
  feedback: string | null;
  gradedAt: Date | null;
  gradedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTeacherHomeworkSubmissionView(
  submission: HomeworkSubmission,
): TeacherHomeworkSubmissionView {
  return {
    id: submission.id,
    homeworkId: submission.homeworkId,
    studentId: submission.studentId,
    studentName: submission.student?.fullName,
    status: submission.status,
    submittedAt: submission.submittedAt,
    score: submission.score,
    feedback: submission.feedback,
    gradedAt: submission.gradedAt,
    gradedByUserId: submission.gradedByUserId,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

// Sprint A.3.3 — GET /teacher/homework/:id/submissions/summary.
//
// Deliberately NOT the same shape as
// HomeworkSubmissionService.getSummary()'s HomeworkSubmissionSummary
// (see that method's own caveat): `totalStudents` here is the teacher's
// *actual assigned roster* for the homework's grade (via
// TeacherService.getMyStudents()), not a count of submission rows, so a
// student who never got a row created for them still counts toward
// missingCount instead of silently vanishing from every total. This is
// the "future teacher-facing summary" that method's comment already
// anticipates -- built in TeacherService by cross-referencing the
// roster against HomeworkSubmissionService's own rows, not a second
// copy of either's business logic.
export interface TeacherHomeworkSubmissionSummaryView {
  homeworkId: string;
  totalStudents: number;
  submittedCount: number;
  pendingCount: number;
  missingCount: number;
  lateCount: number;
}

// Sprint A.3.3 — GET /teacher/homework/:id/submissions/statistics. Same
// roster-aware counts as TeacherHomeworkSubmissionSummaryView above, plus
// the percentage rates derived from them -- one decimal place, 0 when
// totalStudents is 0 (an empty roster has no rate to report, not a
// divide-by-zero NaN). submissionRate folds late submissions in with
// on-time ones (both mean "the student actually turned it in"); onTimeRate
// is the strict submitted-only rate for callers that care about the
// distinction.
export interface TeacherHomeworkSubmissionStatisticsView extends TeacherHomeworkSubmissionSummaryView {
  submissionRate: number;
  onTimeRate: number;
  lateRate: number;
  pendingRate: number;
  missingRate: number;
}
