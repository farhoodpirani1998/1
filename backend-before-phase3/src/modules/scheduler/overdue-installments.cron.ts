import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstallmentsService } from '../tuition/installments/installments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OverdueInstallmentsCron {
  private readonly logger = new Logger(OverdueInstallmentsCron.name);

  constructor(
    private readonly installmentsService: InstallmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Runs every night at 1:00 AM server time.
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueInstallments(): Promise<void> {
    const newlyOverdue = await this.installmentsService.markOverdueInstallments();

    if (newlyOverdue.length === 0) {
      this.logger.log('No installments became overdue tonight');
      return;
    }

    this.logger.log(`${newlyOverdue.length} installment(s) marked overdue — queueing reminders`);

    for (const installment of newlyOverdue) {
      await this.notificationsService.queueOverdueReminder(
        installment.id,
        installment.studentId,
      );
    }
  }
}
