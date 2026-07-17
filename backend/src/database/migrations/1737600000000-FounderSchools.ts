import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5O — Founder (مؤسس) Portal foundation.
 *
 * Adds the many-to-many relationship between a founder-role user
 * (users.role = 'founder') and the school(s) they own. Same shape as
 * ParentPortal's parent_students: no change to the `users` table itself
 * (`role` has always been a free-text VARCHAR(30) with no CHECK
 * constraint, see InitSchema) — only common/authorization/roles.enum.ts
 * changed, for type-safety at the application layer.
 *
 * `founder_schools` is a plain join table (id + two FKs + created_at),
 * same shape as parent_students / teacher_assignments. A unique
 * constraint on (founder_id, school_id) makes linking idempotent —
 * calling link twice for the same pair is a no-op, not a duplicate row.
 *
 * Both FKs are the Postgres default (NO ACTION), consistent with every
 * other FK in this schema per the note in Phase4APerformanceIndexes — no
 * cascading delete is introduced here either.
 */
export class FounderSchools1737600000000 implements MigrationInterface {
  name = 'FounderSchools1737600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE founder_schools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        founder_id UUID NOT NULL REFERENCES users(id),
        school_id UUID NOT NULL REFERENCES schools(id),
        created_at TIMESTAMP DEFAULT now(),
        CONSTRAINT uq_founder_school UNIQUE (founder_id, school_id)
      );
      CREATE INDEX idx_founder_schools_founder ON founder_schools(founder_id);
      CREATE INDEX idx_founder_schools_school ON founder_schools(school_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS founder_schools`);
  }
}
