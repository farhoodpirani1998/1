import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint H3.0 — Homework Grading Foundation.
 *
 * Additive-only: adds four nullable columns to the existing
 * `homework_submissions` table (created by the
 * 1738100000000-HomeworkSubmissions migration). No existing column is
 * renamed, retyped, or dropped, and no existing row is touched -- every
 * pre-existing submission simply has all four new columns as NULL,
 * exactly the "additive column on this same table, not a new migration
 * that recreates it" shape that migration's own header comment
 * anticipated for this exact feature.
 *
 * - score: plain integer, nullable. See HomeworkSubmission entity /
 *   GradeHomeworkSubmissionDto for the 0..(homework.maxScore ?? ∞)
 *   validation applied at the application layer -- no CHECK constraint
 *   is added here, same "validate in the DTO/service, not the schema"
 *   convention every other bounded numeric column in this codebase
 *   (Assessment.score/maxScore, Installment amounts, ...) already
 *   follows.
 * - feedback: free-text, nullable, no length cap at the schema level
 *   (same shape as homework.description).
 * - graded_at: nullable timestamp, same convention as submitted_at.
 * - graded_by_user_id: nullable uuid FK to users(id). No ON DELETE
 *   behavior specified -- the Postgres default (NO ACTION), consistent
 *   with every other FK in this schema (see the note carried over from
 *   1736500000000-Phase4APerformanceIndexes / the HomeworkSubmissions
 *   migration this one extends).
 *
 * No index is added for graded_by_user_id or graded_at: no read path in
 * this sprint filters/sorts by either (grading is reached by
 * submissionId alone -- see TeacherController's new PATCH route), so an
 * index here would be speculative. One can be added in a later
 * migration if a "my recent grading activity" or similar query is ever
 * introduced.
 */
export class HomeworkSubmissionGrading1738700000000 implements MigrationInterface {
  name = 'HomeworkSubmissionGrading1738700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_submissions
        ADD COLUMN score INTEGER,
        ADD COLUMN feedback TEXT,
        ADD COLUMN graded_at TIMESTAMP,
        ADD COLUMN graded_by_user_id UUID REFERENCES users(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_submissions
        DROP COLUMN IF EXISTS graded_by_user_id,
        DROP COLUMN IF EXISTS graded_at,
        DROP COLUMN IF EXISTS feedback,
        DROP COLUMN IF EXISTS score;
    `);
  }
}
