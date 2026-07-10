import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5E — Attendance.
 *
 * Adds the `attendance` table: one row per (student, calendar day),
 * enforced by a unique index so re-submitting the same day corrects the
 * existing row instead of creating a duplicate (see
 * AttendanceService.record()).
 *
 * school_id is stored directly on the row (not derived only through the
 * student join) so /attendance/date/:date -- a whole-school, cross-student
 * query -- can filter and index on it directly, the same reasoning
 * `notifications`/`payments` already store their own tenant-adjacent scoping
 * columns rather than requiring a join for every tenant-scoped read.
 *
 * academic_year_id is captured on the row (copied from the student at the
 * time of marking) rather than only reachable via student_id, so a
 * student's grade/year promotion after the fact doesn't retroactively
 * change which academic year an attendance record is reported under.
 */
export class Attendance1736800000000 implements MigrationInterface {
  name = 'Attendance1736800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_attendance_school_date;
      DROP INDEX IF EXISTS uq_attendance_student_date;
      DROP TABLE IF EXISTS attendance;
    `);
  }
}
