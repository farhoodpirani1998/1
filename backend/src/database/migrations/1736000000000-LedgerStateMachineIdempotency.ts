import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * This migration implements the four structural fixes agreed with the team:
 *
 *  1. Financial Ledger  — an append-only `financial_ledger` table. Nothing in
 *     the app ever UPDATEs or DELETEs a row here; corrections are new rows
 *     (a VOID entry that reverses a PAYMENT entry), the same way real
 *     accounting ledgers work. This becomes the single source of truth for
 *     "how much does this student owe" — reports should read from here
 *     instead of re-deriving totals from payments/installments each time.
 *
 *  2. Installment State Machine — removes `trg_sync_installment_status`.
 *     That trigger silently overwrote `status` on every UPDATE OF paid_amount
 *     based on a hardcoded if/else, which is exactly the "DB trigger vs.
 *     service logic" inconsistency we flagged. Status transitions are now
 *     owned entirely by `InstallmentStateMachine` in the app layer, so there
 *     is one place that knows which transitions are legal. The
 *     `recalc_installment_paid` trigger stays — it's pure arithmetic
 *     (SUM of payments), not business logic, so it's safe to leave in the DB.
 *
 *  3. Idempotency — adds a nullable, unique `idempotency_key` to `payments`.
 *     A client-supplied key (e.g. a UUID generated once per "submit" click)
 *     lets PaymentsService detect retries/double-submits and return the
 *     original payment instead of creating a duplicate.
 *
 *  4. Proper Void flow — adds `voided_by` and `void_reason` to `payments`.
 *     Soft-deleting a payment with no record of who/why was one of the
 *     audit gaps; from now on "deleting" a payment is a `void()` operation
 *     that requires a reason and is itself written to the ledger.
 */
export class LedgerStateMachineIdempotency1736000000000
  implements MigrationInterface
{
  name = 'LedgerStateMachineIdempotency1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Financial ledger (append-only) ---------------------------------
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

    // Belt-and-suspenders at the DB level: even if application code is ever
    // bypassed (raw SQL, a bug, a future dev), nobody can mutate history.
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

    // --- 2. Remove the DB-owned status state machine ------------------------
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_sync_installment_status ON installments`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_installment_status`);

    // Extra statuses the app-level state machine now supports.
    // (column is already VARCHAR(20) with no CHECK constraint, so this is
    // just documentation — enforcement lives in InstallmentStateMachine)
    await queryRunner.query(`
      COMMENT ON COLUMN installments.status IS
        'pending | partial | paid | overdue | cancelled | deferred | disputed — see InstallmentStateMachine for legal transitions';
    `);

    // Prevent duplicate installment_number per plan at the DB level too —
    // closes the race condition the app-level guard alone can't close.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_installment_plan_number
        ON installments(tuition_plan_id, installment_number);
    `);

    // --- 3 & 4. Idempotency + proper void trail on payments -----------------
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payments
        DROP COLUMN IF EXISTS void_reason,
        DROP COLUMN IF EXISTS voided_by,
        DROP COLUMN IF EXISTS idempotency_key;
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_installment_plan_number`,
    );
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
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_forbid_ledger_update ON financial_ledger`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS forbid_ledger_mutation`);
    await queryRunner.query(`DROP TABLE IF EXISTS financial_ledger`);
  }
}
