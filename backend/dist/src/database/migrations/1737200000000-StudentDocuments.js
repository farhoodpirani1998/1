"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentDocuments1737200000000 = void 0;
class StudentDocuments1737200000000 {
    constructor() {
        this.name = 'StudentDocuments1737200000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE student_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        student_id UUID REFERENCES students(id),
        uploaded_by UUID REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        document_type VARCHAR(20) NOT NULL,
        file_url TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      CREATE INDEX idx_student_documents_student
        ON student_documents(student_id, created_at DESC);
      CREATE INDEX idx_student_documents_school
        ON student_documents(school_id);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_student_documents_school;
      DROP INDEX IF EXISTS idx_student_documents_student;
      DROP TABLE IF EXISTS student_documents;
    `);
    }
}
exports.StudentDocuments1737200000000 = StudentDocuments1737200000000;
//# sourceMappingURL=1737200000000-StudentDocuments.js.map