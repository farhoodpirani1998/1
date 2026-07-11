"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentAssessments1736900000000 = void 0;
class StudentAssessments1736900000000 {
    constructor() {
        this.name = 'StudentAssessments1736900000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        title VARCHAR(100) NOT NULL
      );

      CREATE TABLE student_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        student_id UUID REFERENCES students(id),
        subject_id UUID REFERENCES subjects(id),
        academic_year_id UUID REFERENCES academic_years(id),
        term VARCHAR(20) NOT NULL,
        score NUMERIC(5,2) NOT NULL,
        max_score NUMERIC(5,2) NOT NULL DEFAULT 20,
        note TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      CREATE UNIQUE INDEX uq_assessment_student_subject_year_term
        ON student_assessments(student_id, subject_id, academic_year_id, term);
      CREATE INDEX idx_assessment_school_student
        ON student_assessments(school_id, student_id);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_assessment_school_student;
      DROP INDEX IF EXISTS uq_assessment_student_subject_year_term;
      DROP TABLE IF EXISTS student_assessments;
      DROP TABLE IF EXISTS subjects;
    `);
    }
}
exports.StudentAssessments1736900000000 = StudentAssessments1736900000000;
//# sourceMappingURL=1736900000000-StudentAssessments.js.map