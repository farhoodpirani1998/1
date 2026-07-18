import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Password reset (forgot password) — self-service, code-based.
 *
 * Every portal (admin/staff login, teacher login, parent login) shares
 * the same POST /auth/login, so they share this reset flow too: a user
 * who forgot their password requests a one-time numeric code via
 * POST /auth/forgot-password (delivered by SMS through the existing
 * SmsProviderService — see notifications/sms/sms-provider.service.ts),
 * then confirms it plus a new password via POST /auth/reset-password.
 *
 * Only a bcrypt hash of the code is stored (same pattern as
 * password_hash) — never the plaintext code — so a database read alone
 * can't be used to reset an account. The expiry column bounds how long
 * a requested code stays valid; both columns are cleared after a
 * successful reset (or a fresh request overwrites them).
 */
export class PasswordReset1737700000000 implements MigrationInterface {
  name = 'PasswordReset1737700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN reset_code_hash VARCHAR(255),
        ADD COLUMN reset_code_expires_at TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS reset_code_hash,
        DROP COLUMN IF EXISTS reset_code_expires_at;
    `);
  }
}
