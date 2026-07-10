import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InstallmentsService } from '../tuition/installments/installments.service';
import { NotificationsService } from '../notifications/notifications.service';

// Distinct from OVERDUE_CRON_LOCK_KEY (overdue-installments.cron.ts) —
// every advisory lock used in this codebase must be unique.
const UPCOMING_DUE_CRON_LOCK_KEY = 721_900_002;

// How many days before due_date a parent gets the "upcoming due" reminder.
// Kept as a simple constant rather than a per-school setting — there's no
// product requirement yet for that to vary, and it's one line to change
// if that changes.
const UPCOMING_DUE_DAYS_AHEAD = 3;

/**
 * Phase 5C: nightly job that queues "installment due soon" SMS/parent
 * notifications. Unlike OverdueInstallmentsCron, this never changes an
 * installment's status (approaching a due date isn't a state
 * transition), so there's no InstallmentStatusChangedEvent to react to —
 * this calls NotificationsService directly, the same shape the overdue
 * cron used before Domain Events were introduced.
 *
 * Same Postgres advisory-lock pattern as OverdueInstallmentsCron, for the
 * same reason: multi-instance deployments would otherwise all fire at
 * once and queue duplicate reminders.
 */
@Injectable()
export class UpcomingDueInstallmentsCron {
  private readonly logger = new Logger(UpcomingDueInstallmentsCron.name);

  constructor(
    private readonly installmentsService: InstallmentsService,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Runs every night at 2:00 AM server time — offset from the overdue
  // cron's 1:00 AM run so the two never contend for the same connections.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleUpcomingDueInstallments(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const [{ locked }]: [{ locked: boolean }] = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [UPCOMING_DUE_CRON_LOCK_KEY],
      );

      if (!locked) {
        this.logger.log(
          'Another instance already holds the upcoming-due-installments lock — skipping this run',
        );
        return;
      }

      try {
        const candidates = await this.installmentsService.findUpcomingDueInstallments(
          UPCOMING_DUE_DAYS_AHEAD,
        );

        if (candidates.length === 0) {
          this.logger.log('No installments becoming due soon tonight');
          return;
        }

        for (const c of candidates) {
          try {
            await this.notificationsService.queueUpcomingDueReminder(c.id, c.studentId);
          } catch (err) {
            // One installment's notification failing must never abort the
            // rest of the batch — same reasoning as PaymentEventsListener.
            this.logger.error(
              `Failed to queue upcoming-due reminder for installment ${c.id}`,
              err as Error,
            );
          }
        }

        this.logger.log(`${candidates.length} upcoming-due reminder(s) queued`);
      } catch (err) {
        this.logger.error(
          `Failed to process upcoming-due installments: ${(err as Error)?.message ?? err}`,
          (err as Error)?.stack,
        );
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [UPCOMING_DUE_CRON_LOCK_KEY]);
      }
    } finally {
      await queryRunner.release();
    }
  }
}
