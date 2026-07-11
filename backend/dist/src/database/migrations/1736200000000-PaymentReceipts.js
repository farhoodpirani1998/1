"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentReceipts1736200000000 = void 0;
class PaymentReceipts1736200000000 {
    constructor() {
        this.name = 'PaymentReceipts1736200000000';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS receipt_counters`);
        await queryRunner.query(`DROP INDEX IF EXISTS uq_payments_receipt_number`);
        await queryRunner.query(`
      ALTER TABLE payments DROP COLUMN IF EXISTS receipt_number;
    `);
    }
}
exports.PaymentReceipts1736200000000 = PaymentReceipts1736200000000;
//# sourceMappingURL=1736200000000-PaymentReceipts.js.map