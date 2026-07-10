import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5M — School Settings.
 *
 * Adds `school_settings`: exactly one row per school, holding the
 * school's own profile/branding/localization/operational defaults
 * (name, logo, contact info, timezone, language, currency, week/working
 * days, passing score, attendance lateness threshold, tuition reminder
 * lead time, sms/email toggles, brand colors).
 *
 * True one-to-one with `schools` — `school_id` is both the primary key
 * and a foreign key (not a separate `id` column with a unique index on
 * `school_id`), so "exactly one settings record per school" is a DB-level
 * guarantee, not just an application convention. Same "tenant column
 * stored directly on the row" shape as every other tenant-scoped table
 * in this schema, except here the tenant column *is* the primary key
 * rather than an accompanying index, since the relationship is 1:1
 * rather than 1:many.
 *
 * Rows are created lazily (on first GET or PUT /settings, via
 * SchoolSettingsService.findOrCreate — see that service for the default
 * values used) rather than backfilled here for every existing school:
 * no migration-time dependency on the `schools` table's current
 * contents, and a school created after this migration runs gets its
 * settings row the same way a pre-existing one does.
 */
export class SchoolSettings1737500000000 implements MigrationInterface {
  name = 'SchoolSettings1737500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE school_settings (
        school_id UUID PRIMARY KEY REFERENCES schools(id),
        school_name VARCHAR(200) NOT NULL,
        logo_url TEXT,
        address VARCHAR(500),
        phone VARCHAR(20),
        email VARCHAR(255),
        website VARCHAR(255),
        timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Tehran',
        language VARCHAR(10) NOT NULL DEFAULT 'fa',
        currency VARCHAR(10) NOT NULL DEFAULT 'IRR',
        week_starts_on SMALLINT NOT NULL DEFAULT 0,
        working_days SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4}',
        passing_score NUMERIC(5,2) NOT NULL DEFAULT 10,
        attendance_late_minutes SMALLINT NOT NULL DEFAULT 15,
        tuition_reminder_days SMALLINT NOT NULL DEFAULT 7,
        sms_enabled BOOLEAN NOT NULL DEFAULT true,
        email_enabled BOOLEAN NOT NULL DEFAULT false,
        primary_color VARCHAR(7),
        secondary_color VARCHAR(7),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS school_settings`);
  }
}
