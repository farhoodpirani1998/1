import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1735900000000 implements MigrationInterface {
  name = 'InitSchema1735900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`); // gen_random_uuid()

    await queryRunner.query(`
      CREATE TABLE schools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(30) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX idx_users_school ON users(school_id);
    `);

    await queryRunner.query(`
      CREATE TABLE academic_years (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        title VARCHAR(50) NOT NULL,
        start_date DATE,
        end_date DATE,
        is_current BOOLEAN DEFAULT false
      );
      CREATE UNIQUE INDEX uq_academic_year_current
        ON academic_years(school_id)
        WHERE is_current = true;
    `);

    await queryRunner.query(`
      CREATE TABLE grades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        title VARCHAR(50) NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE guardians (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        national_id VARCHAR(20)
      );
      CREATE INDEX idx_guardians_phone ON guardians(phone);
      CREATE INDEX idx_guardians_school_phone ON guardians(school_id, phone);
    `);

    await queryRunner.query(`
      CREATE TABLE students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID REFERENCES schools(id),
        guardian_id UUID REFERENCES guardians(id),
        academic_year_id UUID REFERENCES academic_years(id),
        grade_id UUID REFERENCES grades(id),
        full_name VARCHAR(150) NOT NULL,
        national_id VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        enrollment_date DATE,
        created_at TIMESTAMP DEFAULT now(),
        deleted_at TIMESTAMP
      );
      CREATE INDEX idx_students_school_status ON students(school_id, status) WHERE deleted_at IS NULL;
      CREATE INDEX idx_students_guardian ON students(guardian_id);
    `);

    await queryRunner.query(`
      CREATE TABLE tuition_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id),
        academic_year_id UUID REFERENCES academic_years(id),
        base_amount NUMERIC(14,0) NOT NULL,
        discount_amount NUMERIC(14,0) DEFAULT 0,
        discount_reason VARCHAR(200),
        final_amount NUMERIC(14,0) NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX idx_tuition_plans_student ON tuition_plans(student_id);
    `);

    await queryRunner.query(`
      CREATE TABLE installments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tuition_plan_id UUID REFERENCES tuition_plans(id),
        installment_number INT NOT NULL,
        amount NUMERIC(14,0) NOT NULL,
        due_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        paid_amount NUMERIC(14,0) DEFAULT 0,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX idx_installments_due_status ON installments(due_date, status);
      CREATE INDEX idx_installments_plan ON installments(tuition_plan_id);
    `);

    // Keeps installments.status in sync with paid_amount/due_date on every
    // write — see PaymentsService/InstallmentsService for the app-level
    // callers that trigger this indirectly (by writing paid_amount, due_date).
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

    await queryRunner.query(`
      CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installment_id UUID REFERENCES installments(id),
        amount NUMERIC(14,0) NOT NULL,
        payment_method VARCHAR(30),
        reference_number VARCHAR(100),
        received_by UUID REFERENCES users(id),
        paid_at TIMESTAMP NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT now(),
        deleted_at TIMESTAMP
      );
      CREATE INDEX idx_payments_installment ON payments(installment_id);
    `);

    // Keeps installments.paid_amount as the source-of-truth sum of its
    // non-deleted payments — fires on INSERT, UPDATE (incl. soft-delete's
    // deleted_at write), and DELETE, so PaymentsService never has to
    // maintain paid_amount by hand and can't drift from reality.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recalc_installment_paid() RETURNS TRIGGER AS $$
      BEGIN
        UPDATE installments SET paid_amount = (
          SELECT COALESCE(SUM(amount), 0) FROM payments
          WHERE installment_id = COALESCE(NEW.installment_id, OLD.installment_id)
            AND deleted_at IS NULL
        ) WHERE id = COALESCE(NEW.installment_id, OLD.installment_id);
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_recalc_paid_after_payment
        AFTER INSERT OR UPDATE OR DELETE ON payments
        FOR EACH ROW EXECUTE FUNCTION recalc_installment_paid();
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id),
        installment_id UUID REFERENCES installments(id),
        channel VARCHAR(20) DEFAULT 'sms',
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX idx_notifications_status ON notifications(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order: drop dependents before what they reference.
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_recalc_paid_after_payment ON payments`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS recalc_installment_paid`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sync_installment_status ON installments`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_installment_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS installments`);
    await queryRunner.query(`DROP TABLE IF EXISTS tuition_plans`);
    await queryRunner.query(`DROP TABLE IF EXISTS students`);
    await queryRunner.query(`DROP TABLE IF EXISTS guardians`);
    await queryRunner.query(`DROP TABLE IF EXISTS grades`);
    await queryRunner.query(`DROP TABLE IF EXISTS academic_years`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS schools`);
  }
}
