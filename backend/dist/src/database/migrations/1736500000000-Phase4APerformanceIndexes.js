"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase4APerformanceIndexes1736500000000 = void 0;
class Phase4APerformanceIndexes1736500000000 {
    constructor() {
        this.name = 'Phase4APerformanceIndexes1736500000000';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_academic_years_school`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_grades_school`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_students_grade`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_students_academic_year`);
    }
}
exports.Phase4APerformanceIndexes1736500000000 = Phase4APerformanceIndexes1736500000000;
//# sourceMappingURL=1736500000000-Phase4APerformanceIndexes.js.map