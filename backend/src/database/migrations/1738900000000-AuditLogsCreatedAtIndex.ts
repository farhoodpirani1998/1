import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 2.5 — production readiness: supports the query path
 * AuditController/AuditService.findWithFilters() added for super_admin,
 * which passes `schoolId = null` (see AuditController's own comment —
 * "no single school, sees every school") and therefore adds no
 * `schoolId` predicate at all. None of the existing indexes
 * (idx_audit_school_created, idx_audit_entity, idx_audit_user) help that
 * case or an `action`-only filter across schools: all three lead with a
 * column (school_id / entity_type / user_id) that simply isn't part of
 * that query, so Postgres falls back to a sequential scan + sort on
 * `ORDER BY created_at DESC` as audit_logs grows.
 *
 * Purely additive — does not touch, replace, or duplicate any existing
 * index, and the AuditLog entity's shape (a plain @CreateDateColumn on
 * `createdAt`) doesn't need to change for a plain index like this.
 */
export class AuditLogsCreatedAtIndex1738900000000 implements MigrationInterface {
  name = 'AuditLogsCreatedAtIndex1738900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_audit_created_at;
    `);
  }
}
