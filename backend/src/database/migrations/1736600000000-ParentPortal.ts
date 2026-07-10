import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5A — Parent Portal foundation.
 *
 * Adds the many-to-many relationship between a parent-role user (users.role
 * = 'parent') and the student(s) they're allowed to view. No change to the
 * `users` table itself: `role` has always been a free-text VARCHAR(30) with
 * no CHECK constraint (see InitSchema), so a new role value needs no
 * migration of its own — only common/authorization/roles.enum.ts changed,
 * for type-safety at the application layer.
 *
 * `parent_students` is a plain join table (id + two FKs + created_at),
 * same shape as every other relation table in this schema. A unique
 * constraint on (parent_id, student_id) makes linking idempotent — calling
 * link twice for the same pair is a no-op, not a duplicate row.
 *
 * Both FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes — no
 * cascading delete is introduced here either.
 */
export class ParentPortal1736600000000 implements MigrationInterface {
  name = 'ParentPortal1736600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE parent_students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID NOT NULL REFERENCES users(id),
        student_id UUID NOT NULL REFERENCES students(id),
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
      );
      CREATE INDEX idx_parent_students_parent ON parent_students(parent_id);
      CREATE INDEX idx_parent_students_student ON parent_students(student_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS parent_students`);
  }
}
