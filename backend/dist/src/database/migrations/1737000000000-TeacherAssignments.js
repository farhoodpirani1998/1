"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherAssignments1737000000000 = void 0;
class TeacherAssignments1737000000000 {
    constructor() {
        this.name = 'TeacherAssignments1737000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE teacher_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        teacher_id UUID NOT NULL REFERENCES users(id),
        grade_id UUID NOT NULL REFERENCES grades(id),
        subject_id UUID NOT NULL REFERENCES subjects(id),
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_teacher_assignment UNIQUE (teacher_id, grade_id, subject_id)
      );
      CREATE INDEX idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
      CREATE INDEX idx_teacher_assignments_school ON teacher_assignments(school_id);
      CREATE INDEX idx_teacher_assignments_grade ON teacher_assignments(grade_id);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS teacher_assignments`);
    }
}
exports.TeacherAssignments1737000000000 = TeacherAssignments1737000000000;
//# sourceMappingURL=1737000000000-TeacherAssignments.js.map