"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassesDiscountsProfile1735910000000 = void 0;
class ClassesDiscountsProfile1735910000000 {
    constructor() {
        this.name = 'ClassesDiscountsProfile1735910000000';
    }
    async up(queryRunner) {
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
        await queryRunner.query(`
      CREATE TABLE discount_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        title VARCHAR(100) NOT NULL,
        default_percent NUMERIC(5,2),
        is_active BOOLEAN DEFAULT true
      );
    `);
        await queryRunner.query(`
      ALTER TABLE students
        ADD COLUMN class_id UUID REFERENCES classes(id),
        ADD COLUMN birth_date DATE,
        ADD COLUMN address TEXT,
        ADD COLUMN transferred_from_school_id UUID REFERENCES schools(id);
    `);
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
        await queryRunner.query(`
      ALTER TABLE tuition_plans
        ADD COLUMN discount_type_id UUID REFERENCES discount_types(id);
    `);
        await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN template VARCHAR(30) DEFAULT 'overdue_reminder',
        ALTER COLUMN installment_id DROP NOT NULL;
    `);
    }
    async down(queryRunner) {
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
exports.ClassesDiscountsProfile1735910000000 = ClassesDiscountsProfile1735910000000;
//# sourceMappingURL=1735910000000-ClassesDiscountsProfile.js.map