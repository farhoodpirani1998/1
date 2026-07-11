"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogs1736100000000 = void 0;
class AuditLogs1736100000000 {
    constructor() {
        this.name = 'AuditLogs1736100000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        user_id UUID REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMP DEFAULT now()
      );
      -- No updated_at / deleted_at on purpose: append-only, same as
      -- financial_ledger. Reads are always "as of the time it happened".
      CREATE INDEX idx_audit_school_created ON audit_logs(school_id, created_at);
      CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION forbid_audit_log_mutation() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_forbid_audit_log_update
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_forbid_audit_log_update ON audit_logs`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS forbid_audit_log_mutation`);
        await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    }
}
exports.AuditLogs1736100000000 = AuditLogs1736100000000;
//# sourceMappingURL=1736100000000-AuditLogs.js.map