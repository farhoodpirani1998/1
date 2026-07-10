import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5F — Student Assessment & Report Cards.
 *
 * Adds two tables:
 *
 * `subjects` — a small school-scoped reference list (e.g. "ریاضی"),
 * exactly the same shape as `grades` (modules/grades' academic grade
 * *level* entity, which this is deliberately not conflated with).
 *
 * `student_assessments` — one row per (student, subject, academic year,
 * term), enforced by a unique index so re-submitting the same
 * student+subject+term corrects the existing row instead of creating a
 * duplicate (see AssessmentsService.record()), same pattern as
 * `attendance`'s uq_attendance_student_date.
 *
 * school_id is stored directly on the row (not derived only through the
 * student join), same reasoning `attendance`/`notifications`/`payments`
 * already store their own tenant-adjacent scoping column rather than
 * requiring a join for every tenant-scoped read.
 *
 * academic_year_id is captured on the row (copied from the student at the
 * time of recording) rather than only reachable via student_id, so a
 * student's grade/year promotion after the fact doesn't retroactively
 * change which academic year an assessment is reported under -- same
 * reasoning as attendance.academic_year_id.
 */
export class StudentAssessments1736900000000 implements MigrationInterface {
  name = 'StudentAssessments1736900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_assessment_school_student;
      DROP INDEX IF EXISTS uq_assessment_student_subject_year_term;
      DROP TABLE IF EXISTS student_assessments;
      DROP TABLE IF EXISTS subjects;
    `);
  }
}
