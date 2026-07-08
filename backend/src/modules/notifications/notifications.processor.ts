import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NOTIFICATIONS_QUEUE, NotificationsService } from './notifications.service';
import { SmsProviderService } from './sms/sms-provider.service';
import { Notification, NotificationTemplate } from './entities/notification.entity';

interface SendSmsJobData {
  notificationId: string;
  context?: Record<string, string | number>;
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

    const text = this.buildText(notification, job.data.context);
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

  private buildText(notification: Notification, context?: Record<string, string | number>): string {
    switch (notification.template) {
      case NotificationTemplate.WELCOME:
        return `${notification.student.fullName} عزیز، ثبت‌نام شما در دفتر مدرسه با موفقیت انجام شد. خوش آمدید.`;

      case NotificationTemplate.PAYMENT_CONFIRMATION: {
        const amount = Number(context?.amount ?? notification.installment?.paidAmount ?? 0);
        return `پرداخت به مبلغ ${amount.toLocaleString('fa-IR')} تومان برای ${notification.student.fullName} با موفقیت ثبت شد. سپاسگزاریم.`;
      }

      case NotificationTemplate.OVERDUE_REMINDER:
      default:
        return `دانش‌آموز ${notification.student.fullName}: قسط به مبلغ ${Number(
          notification.installment?.amount ?? 0,
        ).toLocaleString('fa-IR')} تومان سررسید شده است.`;
    }
  }
}
