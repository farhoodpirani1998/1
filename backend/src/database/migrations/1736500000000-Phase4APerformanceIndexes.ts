import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4A database audit — missing indexes.
 *
 * Reviewed every entity/migration for filtered/joined foreign-key columns
 * that had no supporting index. Cascade rules were also reviewed: every
 * FK in the schema is the Postgres default (NO ACTION) — nothing uses
 * ON DELETE CASCADE, so there is no accidental-mass-delete risk to fix.
 *
 * Four columns are actually filtered on in application queries today but
 * were never indexed:
 *
 *  - students.academic_year_id / students.grade_id — both are optional
 *    filters in QueryStudentsDto (StudentsService.findWithFilters), and
 *    both are non-nullable FKs, so every student row exists in one of
 *    these buckets. Without an index, filtering by grade or academic
 *    year forces a sequential scan of the whole students table for that
 *    school once enrollment grows past a trivial size.
 *
 *  - grades.school_id — GradesService.findAll(schoolId) filters on this
 *    with no index at all (the InitSchema migration created the column
 *    but never an index on it).
 *
 *  - academic_years.school_id — AcademicYearsService.findAll(schoolId)
 *    filters on this. The existing `uq_academic_year_current` index only
 *    covers rows WHERE is_current = true, so it can't serve a plain
 *    "all years for this school" lookup.
 *
 * All four are pure additions (CREATE INDEX), so this migration is safe
 * to run against existing data with no risk of failure or data loss.
 */
export class Phase4APerformanceIndexes1736500000000
  implements MigrationInterface
{
  name = 'Phase4APerformanceIndexes1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_students_academic_year
        ON students(academic_year_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_students_grade
        ON students(grade_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grades_school
        ON grades(school_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_academic_years_school
        ON academic_years(school_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_academic_years_school`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_grades_school`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_students_grade`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_students_academic_year`);
  }
}
