import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassesDiscountsProfile1735910000000 implements MigrationInterface {
  name = 'ClassesDiscountsProfile1735910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Classes: the concrete year-specific group ("هفتم/۲") ---
    await queryRunner.query(`
      CREATE TABLE classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        grade_id UUID REFERENCES grades(id),
        academic_year_id UUID REFERENCES academic_years(id),
        title VARCHAR(50) NOT NULL,
        teacher_name VARCHAR(150),
        capacity INT
      );
      CREATE INDEX idx_classes_school_year ON classes(school_id, academic_year_id);
    `);

    // --- Discount types: a per-school catalog of discount reasons ---
    await queryRunner.query(`
      CREATE TABLE discount_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        title VARCHAR(100) NOT NULL,
        default_percent NUMERIC(5,2),
        is_active BOOLEAN DEFAULT true
      );
    `);

    // --- Students: replace direct grade/academicYear with class_id, add
    //     profile fields, add a transfer audit trail ---
    await queryRunner.query(`
      ALTER TABLE students
        ADD COLUMN class_id UUID REFERENCES classes(id),
        ADD COLUMN birth_date DATE,
        ADD COLUMN address TEXT,
        ADD COLUMN transferred_from_school_id UUID REFERENCES schools(id);
    `);

    // Backfill: for any existing student data, create a class per
    // (school, grade, academic_year) combination and point students at it,
    // so no historical enrollment data is lost when grade_id/academic_year_id
    // are dropped below. Safe to run even on an empty table.
    await queryRunner.query(`
      INSERT INTO classes (school_id, grade_id, academic_year_id, title)
      SELECT DISTINCT school_id, grade_id, academic_year_id, 'پیش‌فرض'
      FROM students
      WHERE grade_id IS NOT NULL AND academic_year_id IS NOT NULL;
    `);
    await queryRunner.query(`
      UPDATE students s
      SET class_id = c.id
      FROM classes c
      WHERE c.school_id = s.school_id
        AND c.grade_id = s.grade_id
        AND c.academic_year_id = s.academic_year_id;
    `);

    await queryRunner.query(`
      ALTER TABLE students
        DROP COLUMN grade_id,
        DROP COLUMN academic_year_id;
    `);

    // --- Tuition plans: optional link to a discount type ---
    await queryRunner.query(`
      ALTER TABLE tuition_plans
        ADD COLUMN discount_type_id UUID REFERENCES discount_types(id);
    `);

    // --- Notifications: support multiple message templates, and allow a
    //     notification with no specific installment (e.g. welcome message) ---
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN template VARCHAR(30) DEFAULT 'overdue_reminder',
        ALTER COLUMN installment_id DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        DROP COLUMN template,
        ALTER COLUMN installment_id SET NOT NULL;
    `);
    await queryRunner.query(`ALTER TABLE tuition_plans DROP COLUMN discount_type_id`);
    await queryRunner.query(`
      ALTER TABLE students
        ADD COLUMN grade_id UUID REFERENCES grades(id),
        ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
    `);
    await queryRunner.query(`
      UPDATE students s
      SET grade_id = c.grade_id, academic_year_id = c.academic_year_id
      FROM classes c
      WHERE s.class_id = c.id;
    `);
    await queryRunner.query(`
      ALTER TABLE students
        DROP COLUMN class_id,
        DROP COLUMN birth_date,
        DROP COLUMN address,
        DROP COLUMN transferred_from_school_id;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS discount_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS classes`);
  }
}
