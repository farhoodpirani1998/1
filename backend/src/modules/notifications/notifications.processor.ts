import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NOTIFICATIONS_QUEUE, NotificationsService } from './notifications.service';
import { SmsProviderService } from './sms/sms-provider.service';
import { Notification, NotificationType } from './entities/notification.entity';

interface SendSmsJobData {
  notificationId: string;
}

@Processor(NOTIFICATIONS_QUEUE)
@Injectable()
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly smsProvider: SmsProviderService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<SendSmsJobData>): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: job.data.notificationId },
      relations: ['student', 'student.guardian', 'installment'],
    });
    if (!notification) {
      this.logger.warn(`Notification ${job.data.notificationId} not found, skipping`);
      return;
    }

    const guardianPhone = notification.student.guardian?.phone;
    if (!guardianPhone) {
      this.logger.error(
        `Student ${notification.student.id} has no guardian phone on file — cannot send SMS`,
      );
      await this.notificationsService.markFailed(notification.id);
      return; // no point retrying: there is no phone number to retry with
    }

    const text = this.buildMessage(notification);

    const result = await this.smsProvider.send({ to: guardianPhone, text });

    if (result.success) {
      await this.notificationsService.markSent(notification.id);
    } else {
      // BullMQ will retry per the job's `attempts`/`backoff` options;
      // only mark failed here if you want it reflected immediately in the UI.
      await this.notificationsService.markFailed(notification.id);
      throw new Error('SMS send failed'); // triggers BullMQ retry
    }
  }

  // Phase 5C: notification.type (persisted on the row, see NotificationType)
  // now tells us which of the three messages to send, instead of every SMS
  // reusing the overdue-reminder wording regardless of why it was queued.
  private buildMessage(notification: Notification): string {
    const studentName = notification.student.fullName;
    const amount = Number(notification.installment.amount).toLocaleString('fa-IR');

    switch (notification.type) {
      case NotificationType.PAYMENT_RECEIVED:
        return `دانش‌آموز ${studentName}: پرداخت به مبلغ ${amount} تومان با موفقیت ثبت شد.`;
      case NotificationType.UPCOMING_DUE:
        return `دانش‌آموز ${studentName}: قسط به مبلغ ${amount} تومان به‌زودی سررسید می‌شود.`;
      case NotificationType.OVERDUE_INSTALLMENT:
      default:
        return `دانش‌آموز ${studentName}: قسط به مبلغ ${amount} تومان سررسید شده است.`;
    }
  }
}
