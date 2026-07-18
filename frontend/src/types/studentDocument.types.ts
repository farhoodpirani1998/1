// Student document domain types.
// Mirrors modules/student-documents/* on the backend 1:1. Note: the
// backend does not implement file storage/upload — fileUrl is a
// reference to an already-hosted file the caller supplies, same "store
// the reference, not the bytes" shape as Payment.referenceNumber.

export type StudentDocumentType = 'identity' | 'registration' | 'contract' | 'medical' | 'other';

export interface StudentDocument {
  id: string;
  studentId: string;
  title: string;
  documentType: StudentDocumentType;
  fileUrl: string;
  description: string | null;
  uploadedById: string | null;
  createdAt: string;
}

export const studentDocumentTypeLabels: Record<StudentDocumentType, string> = {
  identity: 'مدرک هویتی',
  registration: 'مدرک ثبت‌نام',
  contract: 'قرارداد',
  medical: 'مدرک پزشکی',
  other: 'سایر',
};
