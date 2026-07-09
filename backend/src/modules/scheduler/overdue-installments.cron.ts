import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstallmentsService } from '../tuition/installments/installments.service';

@Injectable()
export class OverdueInstallmentsCron {
  private readonly logger = new Logger(OverdueInstallmentsCron.name);

  constructor(private readonly installmentsService: InstallmentsService) {}

  // Runs every night at 1:00 AM server time.
  //
  // Note: this no longer calls NotificationsService directly. It just
  // flips status via InstallmentStateMachine, which emits
  // InstallmentStatusChangedEvent per installment — PaymentEventsListener
  // (in NotificationsModule) is the one that reacts to that and queues the
  // reminder. That's the point of Domain Events: this cron doesn't need to
  // know Notifications exists.
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueInstallments(): Promise<void> {
    const newlyOverdue = await this.installmentsService.markOverdueInstallments();

    if (newlyOverdue.length === 0) {
      this.logger.log('No installments became overdue tonight');
      return;
    }

    this.logger.log(`${newlyOverdue.length} installment(s) marked overdue`);
  }
}
