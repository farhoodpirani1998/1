import { Attendance } from '../entities/attendance.entity';

// Staff-facing shape (school_admin / accountant / staff): the full record,
// minus the raw relation objects TypeORM would otherwise attach (school,
// academicYear, recordedBy) -- same "reshape, don't leak the ORM entity
// as-is" reasoning as toParentPaymentView / toParentStudentView elsewhere.
// `studentName` is only populated when the caller eager-loaded `student`
// (see AttendanceService.findByDate, which lists several students at once
// and needs a name to tell rows apart); it's omitted otherwise.
export interface AttendanceView {
  id: string;
  studentId: string;
  studentName?: string;
  academicYearId: string;
  date: string;
  status: string;
  note: string | null;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAttendanceView(attendance: Attendance): AttendanceView {
  return {
    id: attendance.id,
    studentId: attendance.studentId,
    studentName: attendance.student?.fullName,
    academicYearId: attendance.academicYearId,
    date: attendance.date,
    status: attendance.status,
    note: attendance.note,
    recordedById: attendance.recordedById,
    createdAt: attendance.createdAt,
    updatedAt: attendance.updatedAt,
  };
}

// Parent-facing shape: deliberately narrower, same spirit as
// ParentPaymentViewDto -- no recordedById (internal staff user id), no
// schoolId. A parent only needs to know when and how their child was
// marked, plus any note left for them.
export interface ParentAttendanceView {
  id: string;
  date: string;
  status: string;
  note: string | null;
}

export function toParentAttendanceView(attendance: Attendance): ParentAttendanceView {
  return {
    id: attendance.id,
    date: attendance.date,
    status: attendance.status,
    note: attendance.note,
  };
}
