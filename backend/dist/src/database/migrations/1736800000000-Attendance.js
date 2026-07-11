"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attendance1736800000000 = void 0;
class Attendance1736800000000 {
    constructor() {
        this.name = 'Attendance1736800000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        student_id UUID REFERENCES students(id),
        academic_year_id UUID REFERENCES academic_years(id),
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        note TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      CREATE UNIQUE INDEX uq_attendance_student_date ON attendance(student_id, date);
      CREATE INDEX idx_attendance_school_date ON attendance(school_id, date);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_attendance_school_date;
      DROP INDEX IF EXISTS uq_attendance_student_date;
      DROP TABLE IF EXISTS attendance;
    `);
    }
}
exports.Attendance1736800000000 = Attendance1736800000000;
//# sourceMappingURL=1736800000000-Attendance.js.map