import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 hardening: prevents two tuition plans from ever being created
 * for the same (student_id, academic_year_id) pair.
 *
 * TuitionPlansService.create() already checks this at the app level (see
 * the duplicate-plan guard added alongside this migration), but that
 * check alone can't close a race condition between two concurrent
 * requests — this unique index is the real backstop, same pattern as
 * `uq_installment_plan_number` in the LedgerStateMachineIdempotency
 * migration.
 *
 * No existing data is deleted or modified by this migration — it only
 * adds a constraint. If duplicate (student_id, academic_year_id) rows
 * already exist in a given environment, this migration will fail rather
 * than silently dropping data; those duplicates must be resolved
 * manually (e.g. voiding/merging the extra plan) before it can run.
 */
export class TuitionPlanUniqueStudentYear1736300000000
  implements MigrationInterface
{
  name = 'TuitionPlanUniqueStudentYear1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_tuition_plan_student_academic_year
        ON tuition_plans(student_id, academic_year_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_tuition_plan_student_academic_year`,
    );
  }
}
