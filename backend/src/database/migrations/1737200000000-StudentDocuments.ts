import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5I — Student Document Management.
 *
 * Adds a single `student_documents` table: one row per uploaded document
 * reference, scoped to a school and a student. No file storage is
 * implemented in this phase -- `file_url` is stored exactly as given
 * (already-hosted location), same "store the reference, not the bytes"
 * shape as payments.reference_number.
 *
 * Like `announcements`, there is no upsert key here -- a document is a
 * one-shot upload (create or delete, never "correct in place"), so no
 * unique index beyond the primary key is needed.
 *
 * school_id is stored directly on the row (not derived only through a
 * join), same reasoning attendance/student_assessments/announcements
 * already store their own tenant-scoping column rather than requiring a
 * join for every tenant-scoped read.
 */
export class StudentDocuments1737200000000 implements MigrationInterface {
  name = 'StudentDocuments1737200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE student_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        student_id UUID REFERENCES students(id),
        uploaded_by UUID REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        document_type VARCHAR(20) NOT NULL,
        file_url TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      CREATE INDEX idx_student_documents_student
        ON student_documents(student_id, created_at DESC);
      CREATE INDEX idx_student_documents_school
        ON student_documents(school_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_student_documents_school;
      DROP INDEX IF EXISTS idx_student_documents_student;
      DROP TABLE IF EXISTS student_documents;
    `);
  }
}
