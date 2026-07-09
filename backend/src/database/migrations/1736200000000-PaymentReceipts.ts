import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Receipt system (roadmap Phase 2, #3) — data endpoint only, no PDF yet
 * per the spec ("Do not build PDF generation yet").
 *
 * receipt_number format: "<jalali-year>-<6-digit-sequence>", e.g.
 * "1405-000001". The sequence resets every Jalali year, per school (two
 * schools' receipt #1 for 1405 don't collide, and neither does school A's
 * #1 for 1405 vs #1 for 1406).
 *
 * `receipt_counters` holds exactly one row per (school_id, jalali_year)
 * with the last number issued. PaymentsService.create() row-locks that
 * one row (`FOR UPDATE`) inside the same transaction that inserts the
 * payment, increments it, and writes the formatted number onto the
 * payment — so two concurrent payments for the same school/year can never
 * get the same receipt number.
 */
export class PaymentReceipts1736200000000 implements MigrationInterface {
  name = 'PaymentReceipts1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payments
        ADD COLUMN receipt_number VARCHAR(30);

      CREATE UNIQUE INDEX uq_payments_receipt_number
        ON payments(receipt_number)
        WHERE receipt_number IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE receipt_counters (
        school_id UUID NOT NULL REFERENCES schools(id),
        jalali_year INT NOT NULL,
        last_number INT NOT NULL DEFAULT 0,
        PRIMARY KEY (school_id, jalali_year)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS receipt_counters`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_payments_receipt_number`);
    await queryRunner.query(`
      ALTER TABLE payments DROP COLUMN IF EXISTS receipt_number;
    `);
  }
}
