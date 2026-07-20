import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint A.4 — Teacher Announcement Read Tracking.
 *
 * Adds `announcement_reads`: one row per (announcement, user) read,
 * enforced by a unique index so a repeat "mark as read" call corrects
 * (in this case: no-ops against) the existing row instead of creating a
 * duplicate -- same "unique on the pairing, upserted rather than
 * duplicated" shape as uq_homework_submission_homework_student
 * (homework_submissions) and uq_attendance_student_date (attendance).
 *
 * school_id is stored directly on the row (not derived only through the
 * announcement or user join), same reasoning every other tenant-scoped
 * table in this schema (announcements, attendance,
 * homework_submissions, ...) already stores its own scoping column
 * rather than requiring a join for every tenant-scoped read.
 *
 * All FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes.
 */
export class AnnouncementReads1738200000000 implements MigrationInterface {
  name = 'AnnouncementReads1738200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE announcement_reads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        announcement_id UUID NOT NULL REFERENCES announcements(id),
        user_id UUID NOT NULL REFERENCES users(id),
        school_id UUID NOT NULL REFERENCES schools(id),
        read_at TIMESTAMP DEFAULT now()
      );

      -- One read per (announcement, user) -- see the entity header
      -- comment for the "insert once, never overwritten" shape this
      -- backs.
      CREATE UNIQUE INDEX uq_announcement_read_announcement_user
        ON announcement_reads(announcement_id, user_id);

      -- Reader-side reads (GET /teacher/announcements resolving
      -- isRead/readAt for the caller across every announcement in
      -- their school) scan by (school_id, user_id) -- not covered by
      -- the leading column of the unique index above, so a separate
      -- index is added for it.
      CREATE INDEX idx_announcement_reads_school_user
        ON announcement_reads(school_id, user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_announcement_reads_school_user;
      DROP INDEX IF EXISTS uq_announcement_read_announcement_user;
      DROP TABLE IF EXISTS announcement_reads;
    `);
  }
}
