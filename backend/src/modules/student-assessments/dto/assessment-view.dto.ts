import { Assessment } from '../entities/assessment.entity';

// Staff-facing shape: the full record, minus the raw relation objects
// TypeORM would otherwise attach (school, academicYear, recordedBy) --
// same "reshape, don't leak the ORM entity as-is" reasoning as
// toAttendanceView / toParentPaymentView elsewhere. `subjectTitle` is only
// populated when the caller eager-loaded `subject` (every read path in
// this module does), same convention as AttendanceView.studentName.
export interface AssessmentView {
  id: string;
  studentId: string;
  subjectId: string;
  subjectTitle?: string;
  academicYearId: string;
  term: string;
  score: number;
  maxScore: number;
  note: string | null;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAssessmentView(assessment: Assessment): AssessmentView {
  return {
    id: assessment.id,
    studentId: assessment.studentId,
    subjectId: assessment.subjectId,
    subjectTitle: assessment.subject?.title,
    academicYearId: assessment.academicYearId,
    term: assessment.term,
    score: Number(assessment.score),
    maxScore: Number(assessment.maxScore),
    note: assessment.note,
    recordedById: assessment.recordedById,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
  };
}

// Parent-facing shape: deliberately narrower, same spirit as
// ParentAttendanceView -- no recordedById (internal staff user id), no
// schoolId, no studentId (the parent already knows which child they
// asked for). A parent only needs the subject, term, score, and any note
// left for them.
export interface ParentAssessmentView {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  term: string;
  score: number;
  maxScore: number;
  note: string | null;
}

export function toParentAssessmentView(assessment: Assessment): ParentAssessmentView {
  return {
    id: assessment.id,
    subjectId: assessment.subjectId,
    subjectTitle: assessment.subject?.title,
    term: assessment.term,
    score: Number(assessment.score),
    maxScore: Number(assessment.maxScore),
    note: assessment.note,
  };
}
