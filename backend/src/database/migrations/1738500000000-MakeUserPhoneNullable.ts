import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-001 Task 3B — fixes a bug found while wiring up
 * StudentsService.provisionStudentAccount(): `users.phone` was left as
 * `UNIQUE NOT NULL` from InitSchema, but a student-role login authenticates
 * by `username` (added nullable in AddUsernameToUsers) and has no phone
 * number to store. Every provisioning attempt was failing at the DB layer
 * with a NOT NULL violation.
 *
 * Same shape as `username`'s own nullability: NULL is allowed and the
 * existing UNIQUE constraint is untouched (Postgres allows unlimited NULLs
 * under a UNIQUE index), so this is a pure relaxation with nothing to
 * backfill. Every non-student role continues to require and set phone at
 * the application layer (RegisterDto/CreateStudentParentDto/UpdateUserDto
 * all still validate it as a required string) — this migration only stops
 * the DB from rejecting the one row shape that legitimately has none.
 */
export class MakeUserPhoneNullable1738500000000 implements MigrationInterface {
  name = 'MakeUserPhoneNullable1738500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not safely reversible if any student-role row was created with a
    // NULL phone in the meantime — deliberately left for an operator to
    // handle (backfill or delete those rows) rather than silently failing
    // or silently dropping data here.
    await queryRunner.query(`
      ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
    `);
  }
}
