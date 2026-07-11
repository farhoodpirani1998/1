"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Timetable1737300000000 = void 0;
class Timetable1737300000000 {
    constructor() {
        this.name = 'Timetable1737300000000';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS timetable_entries`);
    }
}
exports.Timetable1737300000000 = Timetable1737300000000;
//# sourceMappingURL=1737300000000-Timetable.js.map