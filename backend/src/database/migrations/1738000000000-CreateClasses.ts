import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Class/Section fix -- root cause: the schema previously had no concept
 * finer-grained than Grade. A school with two sections for the same
 * grade (two teachers, two physical classes) had every student of that
 * grade lumped together everywhere -- Student only carried gradeId, and
 * TeacherAssignment only carried (grade, subject), so both teachers ended
 * up scoped to the *entire* grade's roster instead of just their own
 * section.
 *
 * Adds `classes`: one row per physical class/section, scoped to
 * (grade, academic_year) -- a class is re-created (or students
 * re-assigned) each academic year rather than carried forward, matching
 * how `students.academic_year_id` itself already works (see
 * students.entity.ts / InitSchema — no promotion/rollover mechanism
 * exists, a student row is scoped to one academic year already).
 *
 * A unique constraint on (grade_id, academic_year_id, title) prevents
 * two classes with the same label ("الف") under the same grade in the
 * same year.
 *
 * All FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes.
 */
export class CreateClasses1738000000000 implements MigrationInterface {
  name = 'CreateClasses1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        grade_id UUID NOT NULL REFERENCES grades(id),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id),
        title VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_class_grade_year_title UNIQUE (grade_id, academic_year_id, title)
      );
      CREATE INDEX idx_classes_school ON classes(school_id);
      CREATE INDEX idx_classes_grade_year ON classes(grade_id, academic_year_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS classes`);
  }
}
