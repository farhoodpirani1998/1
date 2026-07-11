"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Announcements1737100000000 = void 0;
class Announcements1737100000000 {
    constructor() {
        this.name = 'Announcements1737100000000';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_announcements_school_created;
      DROP INDEX IF EXISTS idx_announcements_school_target;
      DROP TABLE IF EXISTS announcements;
    `);
    }
}
exports.Announcements1737100000000 = Announcements1737100000000;
//# sourceMappingURL=1737100000000-Announcements.js.map