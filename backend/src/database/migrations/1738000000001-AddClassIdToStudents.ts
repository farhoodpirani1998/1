import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up to CreateClasses1738000000000: students can now be pinned to
 * a specific class/section, not just a grade. Nullable -- existing rows
 * (and any school that doesn't split a grade into sections at all) are
 * left with no class, which StudentsService/TeacherService treat as "not
 * yet placed in a section" rather than an error.
 */
export class AddClassIdToStudents1738000000001 implements MigrationInterface {
  name = 'AddClassIdToStudents1738000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE students ADD COLUMN class_id UUID REFERENCES classes(id);
      CREATE INDEX idx_students_class ON students(class_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_students_class;
      ALTER TABLE students DROP COLUMN IF EXISTS class_id;
    `);
  }
}
