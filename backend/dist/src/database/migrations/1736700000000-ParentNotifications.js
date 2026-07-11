"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentNotifications1736700000000 = void 0;
class ParentNotifications1736700000000 {
    constructor() {
        this.name = 'ParentNotifications1736700000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN type VARCHAR(30) NOT NULL DEFAULT 'overdue_installment',
        ADD COLUMN read_at TIMESTAMP NULL;

      CREATE INDEX idx_notifications_student_read ON notifications(student_id, read_at);
      CREATE INDEX idx_notifications_type ON notifications(type);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_notifications_type;
      DROP INDEX IF EXISTS idx_notifications_student_read;
      ALTER TABLE notifications
        DROP COLUMN IF EXISTS read_at,
        DROP COLUMN IF EXISTS type;
    `);
    }
}
exports.ParentNotifications1736700000000 = ParentNotifications1736700000000;
//# sourceMappingURL=1736700000000-ParentNotifications.js.map