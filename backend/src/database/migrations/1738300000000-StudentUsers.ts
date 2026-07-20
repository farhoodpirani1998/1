import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-001 Task 2A — Student portal foundation (entity/schema only).
 *
 * Adds the one-to-one relationship between a student-role user
 * (users.role = 'student', added in ADR-001 Task 1 -- see
 * common/authorization/roles.enum.ts) and the single Student record that
 * login is allowed to see. No change to the `users` or `students` tables
 * themselves: `role` has always been a free-text VARCHAR(30) with no CHECK
 * constraint (see InitSchema), so Task 1 already needed no migration of
 * its own.
 *
 * `student_users` is a plain join table (id + two FKs + created_at), same
 * shape as parent_students / founder_schools. Unlike those many-to-many
 * tables, this relationship is 1:1 in both directions, so it gets two
 * single-column unique constraints instead of one composite unique --
 * uq_student_users_student guarantees a student has at most one linked
 * login, uq_student_users_user guarantees a user account is linked to at
 * most one student.
 *
 * Both FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes -- no
 * cascading delete is introduced here either.
 */
export class StudentUsers1738300000000 implements MigrationInterface {
  name = 'StudentUsers1738300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE student_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id),
        user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_student_users_student UNIQUE (student_id),
        CONSTRAINT uq_student_users_user UNIQUE (user_id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS student_users`);
  }
}
