import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint P1 — Universal Avatar System.
 *
 * Adds `avatar_url` to `users`, not a separate table: one avatar per user,
 * 1:1, same "just another optional column" shape as `username` (see
 * AddUsernameToUsers) rather than a new relation. Nullable with no
 * default -- every existing row gets NULL, which the frontend's existing
 * initial-letter avatar components already treat as "no photo, fall back
 * to initials" (see Sprint P1 Audit report), so this is a pure additive
 * change with nothing to backfill.
 *
 * Stores a relative URL (e.g. "/uploads/avatars/<file>"), not the image
 * bytes -- same "store the reference, not the bytes" convention
 * StudentDocument.fileUrl already established. See
 * AvatarStorageService (common/storage) for what writes/reads this path
 * on disk, and main.ts for the static route that serves it.
 */
export class AddAvatarUrlToUsers1738600000000 implements MigrationInterface {
  name = 'AddAvatarUrlToUsers1738600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN avatar_url VARCHAR(2000);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
    `);
  }
}
