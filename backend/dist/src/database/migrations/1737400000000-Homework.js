"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Homework1737400000000 = void 0;
class Homework1737400000000 {
    constructor() {
        this.name = 'Homework1737400000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE homework (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id),
        grade_id UUID NOT NULL REFERENCES grades(id),
        subject_id UUID NOT NULL REFERENCES subjects(id),
        teacher_id UUID NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        due_date DATE NOT NULL,
        attachment_url TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      -- Teacher-side reads (GET /teacher/homework) scan by
      -- (school, teacher), most recent/soonest first -- same reasoning
      -- idx_timetable_teacher_weekday was added alongside timetable_entries.
      CREATE INDEX idx_homework_teacher ON homework(school_id, teacher_id);

      -- Parent-side / student-profile reads resolve a student's grade,
      -- then scan by (school, grade) -- same reasoning
      -- idx_timetable_grade_weekday was added alongside timetable_entries.
      CREATE INDEX idx_homework_grade ON homework(school_id, grade_id);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS homework`);
    }
}
exports.Homework1737400000000 = Homework1737400000000;
//# sourceMappingURL=1737400000000-Homework.js.map