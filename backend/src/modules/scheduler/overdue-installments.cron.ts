import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InstallmentsService } from '../tuition/installments/installments.service';

// Arbitrary fixed key for Postgres advisory locking — must be unique
// across every advisory lock used in this codebase (there aren't others
// today), not tied to any row ID. Picked once and never reused/changed;
// changing it would let a stuck old-version instance and a new-version
// instance both believe they hold "the" lock during a rolling deploy.
const OVERDUE_CRON_LOCK_KEY = 721_900_001;

@Injectable()
export class OverdueInstallmentsCron {
  private readonly logger = new Logger(OverdueInstallmentsCron.name);

  constructor(
    private readonly installmentsService: InstallmentsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Runs every night at 1:00 AM server time.
  //
  // Note: this no longer calls NotificationsService directly. It just
  // flips status via InstallmentStateMachine, which emits
  // InstallmentStatusChangedEvent per installment — PaymentEventsListener
  // (in NotificationsModule) is the one that reacts to that and queues the
  // reminder. That's the point of Domain Events: this cron doesn't need to
  // know Notifications exists.
  //
  // Phase 4A reliability fixes:
  //  - Multi-instance deployments run @nestjs/schedule's in-process cron
  //    independently on *every* instance — nothing about `@Cron` is
  //    cluster-aware. Without a lock, N running instances would all fire
  //    at 1:00 AM and race to UPDATE the same installment rows (harmless
  //    but wasteful) and each emit its own InstallmentStatusChangedEvent
  //    per row, meaning N duplicate overdue-reminder SMS jobs get queued
  //    per installment. A Postgres advisory lock (session-scoped, so it
  //    must be taken and released on the *same* physical connection —
  //    hence the explicit QueryRunner instead of `dataSource.query()`,
  //    which doesn't guarantee that) makes only one instance actually run
  //    the job body; the rest see `pg_try_advisory_lock` return false and
  //    skip immediately rather than blocking.
  //  - Failure handling: a thrown error here previously had no try/catch,
  //    so a single bad night (e.g. a transient DB blip) would surface only
  //    as an unhandled rejection in the scheduler's internals instead of a
  //    clear log line, and — depending on how far it got — could also
  //    leak the advisory lock. Both are handled below.
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueInstallments(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const [{ locked }]: [{ locked: boolean }] = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [OVERDUE_CRON_LOCK_KEY],
      );

      if (!locked) {
        this.logger.log(
          'Another instance already holds the overdue-installments lock — skipping this run',
        );
        return;
      }

      try {
        const newlyOverdue = await this.installmentsService.markOverdueInstallments();

        if (newlyOverdue.length === 0) {
          this.logger.log('No installments became overdue tonight');
          return;
        }

        this.logger.log(`${newlyOverdue.length} installment(s) marked overdue`);
      } catch (err) {
        // Don't let one bad night crash the process or vanish silently —
        // there's no meaningful "retry" for a daily batch job (it'll run
        // again in 24h and pick up the same overdue candidates then), but
        // the failure must be visible.
        this.logger.error(
          `Failed to process overdue installments: ${(err as Error)?.message ?? err}`,
          (err as Error)?.stack,
        );
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [OVERDUE_CRON_LOCK_KEY]);
      }
    } finally {
      await queryRunner.release();
    }
  }
}
