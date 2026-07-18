import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up to TeacherAssignments1737000000000: subject_id becomes
 * optional. Elementary grades (پایه ابتدایی) don't split instruction by
 * subject -- one teacher covers every subject for the class -- so
 * forcing a subject on every assignment row made it impossible to
 * represent that case at all. A NULL subject_id now means "this teacher
 * covers every subject for this grade", the same convention
 * TeacherService/HomeworkService/TimetableService's assertAssigned()
 * helpers already treat a matching (teacher, grade) row with no subject
 * as satisfying any subject-scoped check.
 *
 * The old uq_teacher_assignment UNIQUE(teacher_id, grade_id, subject_id)
 * is dropped and replaced with two constraints, since Postgres treats
 * every NULL as distinct under a plain UNIQUE and would otherwise let
 * the same teacher+grade be "assigned all subjects" more than once:
 *   - uq_teacher_assignment_subject: unchanged behavior when subject_id
 *     IS NOT NULL (a partial unique index, since a plain UNIQUE can't be
 *     conditioned on IS NOT NULL).
 *   - uq_teacher_assignment_no_subject: one row max per (teacher, grade)
 *     when subject_id IS NULL.
 */
export class TeacherAssignmentSubjectOptional1737800000000 implements MigrationInterface {
  name = 'TeacherAssignmentSubjectOptional1737800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE teacher_assignments ALTER COLUMN subject_id DROP NOT NULL;
      ALTER TABLE teacher_assignments DROP CONSTRAINT uq_teacher_assignment;
      CREATE UNIQUE INDEX uq_teacher_assignment_subject
        ON teacher_assignments(teacher_id, grade_id, subject_id)
        WHERE subject_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_teacher_assignment_no_subject
        ON teacher_assignments(teacher_id, grade_id)
        WHERE subject_id IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Any existing NULL subject_id rows would violate the restored NOT
    // NULL/UNIQUE constraints, so they're removed first -- same
    // "down() may be lossy" tradeoff as other reversible migrations in
    // this project when a forward change relaxes a constraint.
    await queryRunner.query(`
      DELETE FROM teacher_assignments WHERE subject_id IS NULL;
      DROP INDEX IF EXISTS uq_teacher_assignment_no_subject;
      DROP INDEX IF EXISTS uq_teacher_assignment_subject;
      ALTER TABLE teacher_assignments ALTER COLUMN subject_id SET NOT NULL;
      ALTER TABLE teacher_assignments ADD CONSTRAINT uq_teacher_assignment UNIQUE (teacher_id, grade_id, subject_id);
    `);
  }
}
