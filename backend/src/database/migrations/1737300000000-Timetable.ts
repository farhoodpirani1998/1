import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5K — Timetable Foundation.
 *
 * Adds `timetable_entries`: one row per scheduled class period --
 * (school, academic_year, grade, subject, teacher) meeting on one weekday
 * for one time range, with an optional room. No calendar/date logic here
 * (this is a weekly-recurring schedule, not day-specific events) -- see
 * PHASE_5K.md for what's deliberately out of scope.
 *
 * No DB-level overlap constraint (e.g. a Postgres EXCLUDE constraint on
 * (teacher_id, weekday, time range)) is used here -- that needs the
 * `btree_gist` extension enabled, which is a bigger infrastructure step
 * than this phase's minimal-change mandate calls for. Overlap (same
 * teacher, or same grade, colliding on weekday + time range) is instead
 * enforced in TimetableService before every insert/update, the same
 * "application-layer invariant checked in the service, not pushed down to
 * a DB constraint" shape TeacherAssignment's idempotent-upsert and
 * Installment's status transitions already use.
 *
 * school_id is stored directly on the row (not derived only through a
 * join), same reasoning attendance/student_assessments/announcements
 * already store their own tenant-scoping column rather than requiring a
 * join for every tenant-scoped read.
 *
 * All FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes.
 */
export class Timetable1737300000000 implements MigrationInterface {
  name = 'Timetable1737300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE timetable_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id),
        grade_id UUID NOT NULL REFERENCES grades(id),
        subject_id UUID NOT NULL REFERENCES subjects(id),
        teacher_id UUID NOT NULL REFERENCES users(id),
        weekday SMALLINT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        room VARCHAR(50),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        CONSTRAINT chk_timetable_weekday CHECK (weekday BETWEEN 0 AND 6),
        CONSTRAINT chk_timetable_time_range CHECK (start_time < end_time)
      );

      -- Overlap checks (TimetableService.assertNoOverlap) scan by
      -- (school, academic_year, weekday, teacher) and
      -- (school, academic_year, weekday, grade) on every create/update --
      -- one composite index per scan shape, same reasoning
      -- idx_teacher_assignments_teacher/_grade were added alongside
      -- TeacherAssignments.
      CREATE INDEX idx_timetable_teacher_weekday
        ON timetable_entries(school_id, academic_year_id, weekday, teacher_id);
      CREATE INDEX idx_timetable_grade_weekday
        ON timetable_entries(school_id, academic_year_id, weekday, grade_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_entries`);
  }
}
