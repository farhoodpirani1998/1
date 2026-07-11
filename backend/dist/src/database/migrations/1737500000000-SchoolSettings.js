"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchoolSettings1737500000000 = void 0;
class SchoolSettings1737500000000 {
    constructor() {
        this.name = 'SchoolSettings1737500000000';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS school_settings`);
    }
}
exports.SchoolSettings1737500000000 = SchoolSettings1737500000000;
//# sourceMappingURL=1737500000000-SchoolSettings.js.map