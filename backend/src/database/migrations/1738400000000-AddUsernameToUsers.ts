import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-001 Task 3A — Student authentication foundation.
 *
 * Adds `username` to `users`, not `students` — per the architecture rule
 * that User is the only identity entity and Student stays an academic-only
 * record with no login fields of its own (see Student entity / ADR-001).
 * A student's Student record is still reached the same way parent/teacher
 * portals reach theirs: through a join table (student_users, added in
 * 1738300000000-StudentUsers), never by putting identity columns on the
 * academic entity itself.
 *
 * Nullable + unique, same shape as `phone`: every existing row (and every
 * non-student role, which will never set this) gets NULL, and Postgres
 * allows unlimited NULLs under a UNIQUE constraint, so this is a pure
 * additive change with nothing to backfill. Login continues to resolve by
 * `phone` exactly as before for every role -- this column only adds a
 * second lookup key that AuthService.login() checks when a request
 * supplies `username` instead of `phone`.
 */
export class AddUsernameToUsers1738400000000 implements MigrationInterface {
  name = 'AddUsernameToUsers1738400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN username VARCHAR(50);
      ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_username;
      ALTER TABLE users DROP COLUMN IF EXISTS username;
    `);
  }
}
