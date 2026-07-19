import { api } from '../lib/api';

// Admin/staff-facing homework read (HomeworkController on the backend —
// GET /homework/:id). Distinct from teacher.api.ts's getHomework(), which
// calls the teacher-portal route (GET /teacher/homework, scoped to the
// signed-in teacher's own posted rows). Mirrors HomeworkView 1:1 (see
// backend/src/modules/homework/dto/homework-view.dto.ts).
export interface HomeworkDetail {
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
  createdAt: string;
  updatedAt: string;
}

// GET /homework/:id — @Roles('school_admin','accountant','staff'). The
// homework detail page linked from Global Search results.
export function getHomeworkDetail(id: string) {
  return api.get<HomeworkDetail>(`/homework/${id}`);
}
