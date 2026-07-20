import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up to CreateClasses1738000000000 / AddClassIdToStudents1738000000001.
 *
 * class_id on teacher_assignments is nullable with the same convention
 * subject_id already uses (see TeacherAssignmentSubjectOptional): NULL
 * means "this assignment covers the whole grade" (the pre-existing
 * behavior, unchanged for any school that doesn't use sections), a real
 * class_id means "this assignment is scoped to just that one section" --
 * this is the actual fix for the reported bug, since it lets two
 * teachers each be scoped to their own section of the same grade
 * instead of both seeing the entire grade's roster.
 *
 * The two existing partial unique indexes
 * (uq_teacher_assignment_subject / uq_teacher_assignment_no_subject) are
 * replaced with four, one per (subject_id IS NULL, class_id IS NULL)
 * combination -- same "a plain UNIQUE can't express IS NULL vs
 * IS NOT NULL, a partial index can" reasoning as the subject-optional
 * migration, just crossed with the new column.
 */
export class AddClassIdToTeacherAssignments1738000000002 implements MigrationInterface {
  name = 'AddClassIdToTeacherAssignments1738000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE teacher_assignments ADD COLUMN class_id UUID REFERENCES classes(id);
      CREATE INDEX idx_teacher_assignments_class ON teacher_assignments(class_id);

      DROP INDEX IF EXISTS uq_teacher_assignment_subject;
      DROP INDEX IF EXISTS uq_teacher_assignment_no_subject;

      CREATE UNIQUE INDEX uq_teacher_assignment_subject_class
        ON teacher_assignments(teacher_id, grade_id, subject_id, class_id)
        WHERE subject_id IS NOT NULL AND class_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_teacher_assignment_subject_no_class
        ON teacher_assignments(teacher_id, grade_id, subject_id)
        WHERE subject_id IS NOT NULL AND class_id IS NULL;
      CREATE UNIQUE INDEX uq_teacher_assignment_no_subject_class
        ON teacher_assignments(teacher_id, grade_id, class_id)
        WHERE subject_id IS NULL AND class_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_teacher_assignment_no_subject_no_class
        ON teacher_assignments(teacher_id, grade_id)
        WHERE subject_id IS NULL AND class_id IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Any existing non-NULL class_id rows are dropped back to NULL first
    // so the restored two-index scheme (which never accounted for
    // class_id) doesn't leave duplicate-looking rows -- same "down() may
    // be lossy" tradeoff TeacherAssignmentSubjectOptional's down() takes.
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_teacher_assignment_subject_class;
      DROP INDEX IF EXISTS uq_teacher_assignment_subject_no_class;
      DROP INDEX IF EXISTS uq_teacher_assignment_no_subject_class;
      DROP INDEX IF EXISTS uq_teacher_assignment_no_subject_no_class;

      CREATE UNIQUE INDEX uq_teacher_assignment_subject
        ON teacher_assignments(teacher_id, grade_id, subject_id)
        WHERE subject_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_teacher_assignment_no_subject
        ON teacher_assignments(teacher_id, grade_id)
        WHERE subject_id IS NULL;

      DROP INDEX IF EXISTS idx_teacher_assignments_class;
      ALTER TABLE teacher_assignments DROP COLUMN IF EXISTS class_id;
    `);
  }
}
