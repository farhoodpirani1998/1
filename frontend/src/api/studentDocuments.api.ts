import { api } from '../lib/api';
import type { StudentDocument, StudentDocumentType } from '../types/studentDocument.types';

// Matches CreateStudentDocumentDto: title/documentType/fileUrl required,
// description optional. fileUrl must be an already-hosted URL — the
// backend does not accept multipart/binary uploads (Phase 5I note on
// StudentDocument entity).
export interface CreateStudentDocumentInput {
  title: string;
  documentType: StudentDocumentType;
  fileUrl: string;
  description?: string;
}

export function getStudentDocuments(studentId: string) {
  return api.get<StudentDocument[]>(`/students/${studentId}/documents`);
}

export function createStudentDocument(studentId: string, dto: CreateStudentDocumentInput) {
  return api.post<StudentDocument>(`/students/${studentId}/documents`, dto);
}

// Flat delete-by-id — matches DELETE /documents/:id on DocumentsController
// (the document's own id is already globally unique; tenant is re-checked
// server-side from the token, not the URL).
export function deleteStudentDocument(documentId: string) {
  return api.delete(`/documents/${documentId}`);
}
