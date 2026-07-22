import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 2 — Feature 2B: account-level brute-force protection.
 *
 * Two columns on `users`, same "counter + nullable expiry" shape as
 * password reset (reset_code_hash/reset_code_expires_at) and token
 * revocation (token_version) already use on this table:
 *   - failed_login_attempts: consecutive bad-password count for this
 *     account, reset to 0 on any successful login.
 *   - locked_until: NULL while unlocked; set to a future timestamp once
 *     failed_login_attempts reaches LOGIN_LOCKOUT_THRESHOLD (see
 *     AuthService.login). A lock clears itself once this timestamp is in
 *     the past -- no separate "unlock" action or column needed.
 *
 * Purely additive: NOT NULL with a default for the counter, nullable for
 * the expiry, so every existing row is valid immediately and no existing
 * login behavior changes until the first failed attempt is recorded.
 */
export class AddLoginLockoutToUsers1738800000000 implements MigrationInterface {
  name = 'AddLoginLockoutToUsers1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0,
        ADD COLUMN locked_until TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS failed_login_attempts,
        DROP COLUMN IF EXISTS locked_until;
    `);
  }
}
