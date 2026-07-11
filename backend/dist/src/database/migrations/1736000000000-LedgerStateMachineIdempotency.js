"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerStateMachineIdempotency1736000000000 = void 0;
class LedgerStateMachineIdempotency1736000000000 {
    constructor() {
        this.name = 'LedgerStateMachineIdempotency1736000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE financial_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id),
        student_id UUID NOT NULL REFERENCES students(id),
        tuition_plan_id UUID REFERENCES tuition_plans(id),
        entry_type VARCHAR(20) NOT NULL, -- CHARGE | DISCOUNT | PAYMENT | VOID
        amount NUMERIC(14,0) NOT NULL,   -- signed: charges/discounts positive
                                          -- convention below, payments negative
                                          -- (see LedgerService for the sign rule)
        reference_type VARCHAR(30) NOT NULL, -- tuition_plan | payment
        reference_id UUID NOT NULL,
        performed_by UUID REFERENCES users(id),
        reason TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT now()
      );
      -- No updated_at / deleted_at columns on purpose: this table is
      -- append-only. Corrections are new rows, never UPDATE/DELETE.
      CREATE INDEX idx_ledger_school_created ON financial_ledger(school_id, created_at);
      CREATE INDEX idx_ledger_student ON financial_ledger(student_id, created_at);
      CREATE INDEX idx_ledger_reference ON financial_ledger(reference_type, reference_id);
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'financial_ledger is append-only: % is not allowed', TG_OP;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_forbid_ledger_update
        BEFORE UPDATE OR DELETE ON financial_ledger
        FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
    `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sync_installment_status ON installments`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS sync_installment_status`);
        await queryRunner.query(`
      COMMENT ON COLUMN installments.status IS
        'pending | partial | paid | overdue | cancelled | deferred | disputed — see InstallmentStateMachine for legal transitions';
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX uq_installment_plan_number
        ON installments(tuition_plan_id, installment_number);
    `);
        await queryRunner.query(`
      ALTER TABLE payments
        ADD COLUMN idempotency_key VARCHAR(100),
        ADD COLUMN voided_by UUID REFERENCES users(id),
        ADD COLUMN void_reason TEXT;

      CREATE UNIQUE INDEX uq_payments_idempotency_key
        ON payments(idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE payments
        DROP COLUMN IF EXISTS void_reason,
        DROP COLUMN IF EXISTS voided_by,
        DROP COLUMN IF EXISTS idempotency_key;
    `);
        await queryRunner.query(`DROP INDEX IF EXISTS uq_installment_plan_number`);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_installment_status() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.paid_amount <= 0 THEN
          NEW.status := CASE WHEN NEW.due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END;
        ELSIF NEW.paid_amount < NEW.amount THEN
          NEW.status := 'partial';
        ELSE
          NEW.status := 'paid';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_sync_installment_status
        BEFORE INSERT OR UPDATE OF paid_amount, due_date ON installments
        FOR EACH ROW EXECUTE FUNCTION sync_installment_status();
    `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_forbid_ledger_update ON financial_ledger`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS forbid_ledger_mutation`);
        await queryRunner.query(`DROP TABLE IF EXISTS financial_ledger`);
    }
}
exports.LedgerStateMachineIdempotency1736000000000 = LedgerStateMachineIdempotency1736000000000;
//# sourceMappingURL=1736000000000-LedgerStateMachineIdempotency.js.map