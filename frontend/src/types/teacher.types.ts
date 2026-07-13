// Teacher portal domain types.
// Mirrors the backend Teacher module shapes 1:1 (see
// backend/src/modules/teacher/dto/teacher-view.dto.ts for the profile
// view, and the raw Grade/Subject entities returned as-is by
// GET /teacher/classes and GET /teacher/subjects — see
// TeacherService.getMyClasses/getMySubjects). Do NOT add fields/concepts
// here that don't exist on those shapes — same rule as every other
// types/*.ts file in this project (see auth.types.ts, parent.types.ts).
//
// Sprint 1 scope only: profile/classes/subjects. Attendance, assessment,
// homework, timetable, and announcement view models are intentionally
// left for the sprints that build those pages.

// One grade+subject assignment as summarized on the teacher's own
// profile. Mirrors TeacherProfileView['assignments'] entries.
export interface TeacherAssignmentSummary {
  id: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
}

// Mirrors backend TeacherProfileView (teacher-view.dto.ts), returned by
// GET /teacher/profile.
export interface TeacherProfileView {
  id: string;
  fullName: string;
  phone: string;
  schoolId: string;
  isActive: boolean;
  assignments: TeacherAssignmentSummary[];
}

// GET /teacher/classes returns the raw Grade entities the teacher is
// currently assigned to, deduped by grade (see
// TeacherService.getMyClasses) — { id, schoolId, title }, same shape as
// modules/grades' Grade entity.
export interface TeacherClassView {
  id: string;
  schoolId: string;
  title: string;
}

// GET /teacher/subjects returns the raw Subject entities the teacher is
// currently assigned to, deduped by subject (see
// TeacherService.getMySubjects) — same shape as Grade above.
export interface TeacherSubjectView {
  id: string;
  schoolId: string;
  title: string;
}

// Sprint 2B: the school-wide Subject reference list (GET /subjects,
// SubjectsController), same shape as modules/grades' Grade — { id, title }.
// Distinct from TeacherSubjectView above, which is the signed-in
// teacher's own deduped subject list, not this full reference list.
export interface Subject {
  id: string;
  title: string;
}
