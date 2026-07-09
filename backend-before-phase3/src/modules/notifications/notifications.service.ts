import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus, NotificationTemplate } from './entities/notification.entity';

export const NOTIFICATIONS_QUEUE = 'notifications';

interface SendSmsJobData {
  notificationId: string;
  // Snapshot of anything the message text needs at send time, so a later
  // change to the underlying row (e.g. paid_amount continuing to move)
  // can't change what an already-queued confirmation says.
  context?: Record<string, string | number>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Called by the overdue-installments cron. Creates a `pending`
   * notification row, then enqueues a BullMQ job that the processor picks
   * up asynchronously — so the cron tick that triggered this never blocks
   * on the actual SMS gateway call.
   */
  async queueOverdueReminder(installmentId: string, studentId: string): Promise<Notification> {
    return this.enqueue({
      studentId,
      installmentId,
      template: NotificationTemplate.OVERDUE_REMINDER,
    });
  }

  /** Called right after PaymentsService.create() commits successfully. */
  async queuePaymentConfirmation(
    installmentId: string,
    studentId: string,
    amount: number,
  ): Promise<Notification> {
    return this.enqueue({
      studentId,
      installmentId,
      template: NotificationTemplate.PAYMENT_CONFIRMATION,
      context: { amount },
    });
  }

  /** Called right after StudentsService.create() commits successfully. */
  async queueWelcomeMessage(studentId: string): Promise<Notification> {
    return this.enqueue({
      studentId,
      installmentId: null,
      template: NotificationTemplate.WELCOME,
    });
  }

  private async enqueue(params: {
    studentId: string;
    installmentId: string | null;
    template: NotificationTemplate;
    context?: Record<string, string | number>;
  }): Promise<Notification> {
    const notification = this.notificationRepo.create({
      studentId: params.studentId,
      installmentId: params.installmentId,
      template: params.template,
      channel: 'sms',
      status: NotificationStatus.PENDING,
    });
    const saved = await this.notificationRepo.save(notification);

    const jobData: SendSmsJobData = { notificationId: saved.id, context: params.context };
    await this.notificationsQueue.add('send-sms', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return saved;
  }

  async markSent(id: string): Promise<void> {
    await this.notificationRepo.update(id, {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.notificationRepo.update(id, { status: NotificationStatus.FAILED });
  }
}
