import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint A.3.1 — Homework Submission Foundation.
 *
 * Adds `homework_submissions`: one row per (homework, student), enforced
 * by a unique index so a future submit/resubmit path corrects the
 * existing row instead of creating a duplicate -- same "unique on the
 * pairing, upserted rather than duplicated" shape as
 * uq_attendance_student_date (attendance) and
 * uq_assessment_student_subject_year_term (student_assessments).
 *
 * school_id is stored directly on the row (not derived only through the
 * homework or student join), same reasoning every other tenant-scoped
 * table in this schema (attendance, student_assessments, homework
 * itself, ...) already stores its own scoping column rather than
 * requiring a join for every tenant-scoped read.
 *
 * This migration is schema/wiring only (Sprint A.3.1) -- no
 * service/controller/business logic is added in this sprint. `status`
 * defaults to 'pending' and `submitted_at` is nullable until a future
 * submission path sets it. No score/grade or file-attachment columns are
 * added yet; when that lands it's an additive column on this same table
 * (see the entity's header comment), not a new migration that recreates
 * it.
 *
 * All FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes.
 */
export class HomeworkSubmissions1738100000000 implements MigrationInterface {
  name = 'HomeworkSubmissions1738100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE homework_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        homework_id UUID NOT NULL REFERENCES homework(id),
        student_id UUID NOT NULL REFERENCES students(id),
        school_id UUID NOT NULL REFERENCES schools(id),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      -- One submission per (homework, student) -- see the entity header
      -- comment for the upsert-on-resubmit shape this backs.
      CREATE UNIQUE INDEX uq_homework_submission_homework_student
        ON homework_submissions(homework_id, student_id);

      -- Teacher-side reads (a future "who has/hasn't submitted this
      -- homework" view) scan by homework_id alone -- already covered by
      -- the leading column of the unique index above, so no separate
      -- index is added for it.

      -- Student/parent-side reads scan by (school, student) -- same
      -- reasoning idx_homework_teacher / idx_homework_grade were added
      -- alongside the homework table itself.
      CREATE INDEX idx_homework_submissions_school_student
        ON homework_submissions(school_id, student_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_homework_submissions_school_student;
      DROP INDEX IF EXISTS uq_homework_submission_homework_student;
      DROP TABLE IF EXISTS homework_submissions;
    `);
  }
}
