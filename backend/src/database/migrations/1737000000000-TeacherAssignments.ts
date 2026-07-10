import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5G — Teacher Portal Foundation.
 *
 * Adds `teacher_assignments`: the table that scopes a teacher-role user
 * (users.role = 'teacher') to exactly the grade(s) + subject(s) they may
 * act on. No change to the `users` table itself: `role` has always been a
 * free-text VARCHAR(30) with no CHECK constraint (see InitSchema), so a
 * new role value needs no migration of its own — only
 * common/authorization/roles.enum.ts changed, for type-safety at the
 * application layer (same note as ParentPortal's migration for `parent`).
 *
 * One row per (teacher, grade, subject) combination — a teacher who
 * teaches two subjects to the same grade gets two rows, and a teacher who
 * teaches one subject across two grades also gets two rows. This is the
 * finest-grained shape that still answers "can this teacher take
 * attendance for this grade" (any row with this gradeId) and "can this
 * teacher record an assessment for this grade+subject" (a row matching
 * both) without a separate join table for each question.
 *
 * A unique constraint on (teacher_id, grade_id, subject_id) makes
 * assigning idempotent — the same triple twice is a no-op, not a
 * duplicate row — same shape as parent_students' uq_parent_student.
 *
 * school_id is stored directly on the row (not derived only through the
 * teacher or grade join), same reasoning attendance/student_assessments
 * already store their own tenant-scoping column rather than requiring a
 * join for every tenant-scoped read.
 *
 * All FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes — no
 * cascading delete is introduced here either.
 */
export class TeacherAssignments1737000000000 implements MigrationInterface {
  name = 'TeacherAssignments1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE teacher_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        teacher_id UUID NOT NULL REFERENCES users(id),
        grade_id UUID NOT NULL REFERENCES grades(id),
        subject_id UUID NOT NULL REFERENCES subjects(id),
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_teacher_assignment UNIQUE (teacher_id, grade_id, subject_id)
      );
      CREATE INDEX idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
      CREATE INDEX idx_teacher_assignments_school ON teacher_assignments(school_id);
      CREATE INDEX idx_teacher_assignments_grade ON teacher_assignments(grade_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_assignments`);
  }
}
