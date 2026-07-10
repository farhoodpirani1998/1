import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5C — Parent Notifications.
 *
 * `notifications` already existed (InitSchema) as a purely internal SMS
 * delivery log: student_id/installment_id/channel/status/sent_at. There
 * was no way to tell *why* a row existed (payment receipt vs. overdue
 * reminder — that distinction only ever lived in an ephemeral BullMQ job
 * payload, never persisted) and no "read" concept at all, since no one
 * but the SMS processor ever read this table.
 *
 * This adds exactly the two columns the parent-facing list/mark-read API
 * needs:
 *   - type: persists what was previously a transient queue-job field, so
 *     it can be filtered/displayed later without re-deriving it.
 *   - read_at: nullable timestamp: NULL = unread, set = read. A
 *     timestamp instead of a plain boolean, same reasoning as sent_at
 *     already in this table — "when" is free once you're storing "if".
 *
 * Both are backward compatible: existing rows get type defaulted to
 * 'overdue_installment' (the only kind of notification that existed
 * before this phase) and read_at NULL (unread), no other row changes.
 */
export class ParentNotifications1736700000000 implements MigrationInterface {
  name = 'ParentNotifications1736700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN type VARCHAR(30) NOT NULL DEFAULT 'overdue_installment',
        ADD COLUMN read_at TIMESTAMP NULL;

      CREATE INDEX idx_notifications_student_read ON notifications(student_id, read_at);
      CREATE INDEX idx_notifications_type ON notifications(type);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_notifications_type;
      DROP INDEX IF EXISTS idx_notifications_student_read;
      ALTER TABLE notifications
        DROP COLUMN IF EXISTS read_at,
        DROP COLUMN IF EXISTS type;
    `);
  }
}
