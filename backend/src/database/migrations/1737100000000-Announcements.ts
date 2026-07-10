import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5H — School Announcements.
 *
 * Adds a single `announcements` table: one row per posted announcement,
 * scoped to a school and an audience (`target_type`: all / parents /
 * teachers / staff). Unlike attendance/student_assessments there is no
 * upsert key here -- an announcement is a one-shot post (create or
 * delete, never "correct in place"), so no unique index beyond the
 * primary key is needed.
 *
 * school_id is stored directly on the row (not derived only through a
 * join), same reasoning attendance/student_assessments/notifications
 * already store their own tenant-adjacent scoping column rather than
 * requiring a join for every tenant-scoped read.
 */
export class Announcements1737100000000 implements MigrationInterface {
  name = 'Announcements1737100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now()
      );

      CREATE INDEX idx_announcements_school_target
        ON announcements(school_id, target_type);
      CREATE INDEX idx_announcements_school_created
        ON announcements(school_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_announcements_school_created;
      DROP INDEX IF EXISTS idx_announcements_school_target;
      DROP TABLE IF EXISTS announcements;
    `);
  }
}
