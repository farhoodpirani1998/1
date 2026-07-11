"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuitionPlanUniqueStudentYear1736300000000 = void 0;
class TuitionPlanUniqueStudentYear1736300000000 {
    constructor() {
        this.name = 'TuitionPlanUniqueStudentYear1736300000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE UNIQUE INDEX uq_tuition_plan_student_academic_year
        ON tuition_plans(student_id, academic_year_id);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS uq_tuition_plan_student_academic_year`);
    }
}
exports.TuitionPlanUniqueStudentYear1736300000000 = TuitionPlanUniqueStudentYear1736300000000;
//# sourceMappingURL=1736300000000-TuitionPlanUniqueStudentYear.js.map