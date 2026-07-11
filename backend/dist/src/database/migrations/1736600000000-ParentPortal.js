"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentPortal1736600000000 = void 0;
class ParentPortal1736600000000 {
    constructor() {
        this.name = 'ParentPortal1736600000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE parent_students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID NOT NULL REFERENCES users(id),
        student_id UUID NOT NULL REFERENCES students(id),
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
      );
      CREATE INDEX idx_parent_students_parent ON parent_students(parent_id);
      CREATE INDEX idx_parent_students_student ON parent_students(student_id);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS parent_students`);
    }
}
exports.ParentPortal1736600000000 = ParentPortal1736600000000;
//# sourceMappingURL=1736600000000-ParentPortal.js.map