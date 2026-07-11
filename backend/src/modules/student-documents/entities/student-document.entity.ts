import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';

// Kept as a small closed enum, same shape as AttendanceStatus /
// AssessmentTerm / AnnouncementTargetType, rather than free text -- a
// fixed, known set of document categories is what the student profile /
// admin UI filter by, not an arbitrary string.
export enum StudentDocumentType {
  IDENTITY = 'identity',
  REGISTRATION = 'registration',
  CONTRACT = 'contract',
  MEDICAL = 'medical',
  OTHER = 'other',
}

// One row per uploaded document reference. Phase 5I deliberately does not
// implement file storage/upload itself -- `fileUrl` is stored as given
// (already-hosted location), same "store the reference, not the bytes"
// shape as Payment.referenceNumber. A future storage phase can start
// writing real object-storage URLs into this same column without a schema
// change.
//
// No upsert key here (unlike Attendance/Assessment) -- a document is a
// one-shot upload (create or delete, never "correct in place"), same
// reasoning as Announcement.
@Entity('student_documents')
export class StudentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  // Nullable for the same reason Attendance.recordedById /
  // Assessment.recordedById / Announcement.createdById are nullable: so a
  // future admin-deletion of the uploading user's account doesn't force a
  // cascade delete of every document they ever uploaded.
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User | null;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedById: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'document_type', type: 'varchar', length: 20 })
  documentType: StudentDocumentType;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
