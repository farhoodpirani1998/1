import { Homework } from '../entities/homework.entity';

// Staff/teacher-facing shape: the full record, minus the raw relation
// objects TypeORM would otherwise attach (school, academicYear) -- same
// "reshape, don't leak the ORM entity as-is" reasoning as
// toTimetableEntryView / toStudentDocumentView elsewhere. gradeTitle/
// subjectTitle/teacherName are only populated when the caller
// eager-loaded those relations (every read path in this module does).
export interface HomeworkView {
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
}

export function toHomeworkView(homework: Homework): HomeworkView {
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
  };
}

// Parent/student-profile-facing shape: same fields as HomeworkView --
// unlike StudentDocument there's no internal-only column (no
// "uploadedById") on Homework that needs hiding from a recipient; teacher
// name/subject/grade are all information a parent is meant to see. Kept
// as its own named type/function anyway, same "one mapper per call site"
// convention as toParentStudentDocumentView / toRecipientTimetableEntryView,
// so a future admin-only field can be added to HomeworkView without
// silently leaking into a recipient's response.
export type RecipientHomeworkView = HomeworkView;

export function toRecipientHomeworkView(homework: Homework): RecipientHomeworkView {
  return toHomeworkView(homework);
}
