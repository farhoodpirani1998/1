import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5L — Homework & Assignments.
 *
 * Adds `homework`: one row per homework/assignment a teacher posts for a
 * (school, academic_year, grade, subject) they are assigned to teach.
 * Same "one table, tenant column stored directly on the row" shape as
 * timetable_entries / student_documents / announcements -- school_id is
 * stored directly rather than derived only through a join, so every
 * tenant-scoped read stays a single indexed lookup.
 *
 * No file storage is implemented here -- `attachment_url` stores an
 * already-hosted location only, same "store the reference, not the
 * bytes" shape as StudentDocument.fileUrl / Payment.referenceNumber.
 *
 * All FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes.
 */
export class Homework1737400000000 implements MigrationInterface {
  name = 'Homework1737400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE homework (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id),
        grade_id UUID NOT NULL REFERENCES grades(id),
        subject_id UUID NOT NULL REFERENCES subjects(id),
        teacher_id UUID NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        due_date DATE NOT NULL,
        attachment_url TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      -- Teacher-side reads (GET /teacher/homework) scan by
      -- (school, teacher), most recent/soonest first -- same reasoning
      -- idx_timetable_teacher_weekday was added alongside timetable_entries.
      CREATE INDEX idx_homework_teacher ON homework(school_id, teacher_id);

      -- Parent-side / student-profile reads resolve a student's grade,
      -- then scan by (school, grade) -- same reasoning
      -- idx_timetable_grade_weekday was added alongside timetable_entries.
      CREATE INDEX idx_homework_grade ON homework(school_id, grade_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS homework`);
  }
}
