import { StudentDocument } from '../entities/student-document.entity';

// Staff-facing shape: the full record, minus the raw relation objects
// TypeORM would otherwise attach (school, student, uploadedBy) -- same
// "reshape, don't leak the ORM entity as-is" reasoning as
// toAssessmentView / toAnnouncementView elsewhere.
export interface StudentDocumentView {
  id: string;
  studentId: string;
  title: string;
  documentType: string;
  fileUrl: string;
  description: string | null;
  uploadedById: string | null;
  createdAt: Date;
}

export function toStudentDocumentView(document: StudentDocument): StudentDocumentView {
  return {
    id: document.id,
    studentId: document.studentId,
    title: document.title,
    documentType: document.documentType,
    fileUrl: document.fileUrl,
    description: document.description,
    uploadedById: document.uploadedById,
    createdAt: document.createdAt,
  };
}

// Parent-facing shape: deliberately narrower, same spirit as
// ParentAssessmentView / ParentAttendanceView -- no uploadedById (internal
// staff user id), no schoolId, no studentId (the parent already knows
// which child they asked for).
export interface ParentStudentDocumentView {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  description: string | null;
  createdAt: Date;
}

export function toParentStudentDocumentView(document: StudentDocument): ParentStudentDocumentView {
  return {
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    fileUrl: document.fileUrl,
    description: document.description,
    createdAt: document.createdAt,
  };
}
