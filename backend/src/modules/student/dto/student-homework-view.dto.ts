import { Homework } from '../../homework/entities/homework.entity';
import { HomeworkSubmission } from '../../homework/entities/homework-submission.entity';

// ADR-001 Task 4E: student-facing shape for GET /student/homework.
//
// The homework fields mirror RecipientHomeworkView (see
// homework/dto/homework-view.dto.ts) -- same "reshape, don't leak the ORM
// entity as-is" reasoning, and nothing on Homework itself is staff-only
// (no recordedById-style column), so no field needs hiding there.
//
// submissionStatus/submittedAt are the one thing a plain RecipientHomeworkView
// doesn't carry: the authenticated student's own HomeworkSubmission row for
// this homework, resolved via HomeworkSubmissionService.findForHomeworkAndStudent
// -- never another student's. Both are null when no submission row has been
// recorded yet (see that method's own "returns null rather than throwing"
// convention) -- a missing row is a normal, not-yet-submitted state, not an
// error, so this deliberately does not default it to any particular status
// string itself.
export interface StudentHomeworkView {
  id: string;
  academicYearId: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  submissionStatus: string | null;
  submittedAt: Date | null;
}

export function toStudentHomeworkView(
  homework: Homework,
  submission: HomeworkSubmission | null,
): StudentHomeworkView {
  return {
    id: homework.id,
    academicYearId: homework.academicYearId,
    gradeId: homework.gradeId,
    gradeTitle: homework.grade?.title,
    subjectId: homework.subjectId,
    subjectTitle: homework.subject?.title,
    teacherId: homework.teacherId,
    teacherName: homework.teacher?.fullName,
    title: homework.title,
    description: homework.description,
    dueDate: homework.dueDate,
    attachmentUrl: homework.attachmentUrl,
    createdAt: homework.createdAt,
    updatedAt: homework.updatedAt,
    submissionStatus: submission?.status ?? null,
    submittedAt: submission?.submittedAt ?? null,
  };
}
