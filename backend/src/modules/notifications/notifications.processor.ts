import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NOTIFICATIONS_QUEUE, NotificationsService } from './notifications.service';
import { SmsProviderService } from './sms/sms-provider.service';
import { Notification } from './entities/notification.entity';

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

    const text = `دانش‌آموز ${notification.student.fullName}: قسط به مبلغ ${Number(
      notification.installment.amount,
    ).toLocaleString('fa-IR')} تومان سررسید شده است.`;

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
}
