import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 hardening: adds `token_version` to `users`.
 *
 * JwtStrategy now rejects any token whose embedded tokenVersion doesn't
 * match this column's current value, so previously-issued JWTs are
 * invalidated whenever AuthService.changePassword() (or a future
 * security-reset action) increments it. Existing rows default to 0,
 * matching the value every currently-valid token was signed with (they
 * predate this column and never carried a tokenVersion claim), so no
 * currently-logged-in user is logged out by this migration itself.
 */
export class UserTokenVersion1736400000000 implements MigrationInterface {
  name = 'UserTokenVersion1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN token_version integer NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN token_version;
    `);
  }
}
