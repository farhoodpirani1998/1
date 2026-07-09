import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import {
  DOMAIN_EVENTS,
  PaymentRecordedEvent,
  InstallmentStatusChangedEvent,
} from '../../common/events/domain-events';

/**
 * This is the payoff of Domain Events: PaymentsService/TuitionPlansService
 * never import NotificationsService. They emit an event and move on; this
 * listener reacts to it. If the SMS gateway is slow or down, that's a
 * problem for BullMQ's retry/backoff — it can never fail or roll back the
 * payment transaction, because by the time this runs, that transaction has
 * already committed.
 */
@Injectable()
export class PaymentEventsListener {
  private readonly logger = new Logger(PaymentEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(DOMAIN_EVENTS.PAYMENT_RECORDED)
  async onPaymentRecorded(event: PaymentRecordedEvent) {
    if (event.wasIdempotentReplay) return; // don't re-notify on a retried request
    try {
      await this.notifications.queuePaymentReceipt(event.installmentId, event.studentId);
    } catch (err) {
      // A notification failure must never surface as a payment failure —
      // it already happened. Log and move on.
      this.logger.error(
        `Failed to queue payment receipt for payment ${event.paymentId}`,
        err as Error,
      );
    }
  }

  @OnEvent(DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED)
  async onInstallmentStatusChanged(event: InstallmentStatusChangedEvent) {
    if (event.toStatus === 'overdue') {
      try {
        await this.notifications.queueOverdueReminder(event.installmentId, event.studentId);
      } catch (err) {
        this.logger.error(
          `Failed to queue overdue reminder for installment ${event.installmentId}`,
          err as Error,
        );
      }
    }
  }
}
